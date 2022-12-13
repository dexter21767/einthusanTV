const { parse } = require("fast-html-parser");
const youtubedl = require("youtube-dl-exec");
const axios = require('axios').default;

const baseURL = "https://einthusan.tv";

const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const StreamCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const MetaCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const CatalogCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });



client = axios.create({
    baseURL: baseURL,
    timeout: 5000
});

async function request(url, data) {

    //console.log(url,'url');
    return await axios
        .get(url)
        .then(res => {

            // console.log(`statusCode: ${res.status}`);
            return res;

        })
        .catch(error => {
            //console.error(error);
            console.log('error');
        });

}

async function stream(einthusan_id) {
    try {
        var id = einthusan_id.split(":")[1];
        const Cached = StreamCache.get(id);
        if (Cached) return Cached;

        let url = `${baseURL}/movie/watch/${id}/`;
        let info = await youtubedl(url, {
            dumpSingleJson: true
        });

        if (!info) throw "error on youtubedl";

        let streams = {
            name: 'einthusan',
            description: 'einthusan',
            url: info.url,
        };
        //console.log(streams)
        if (streams) StreamCache.set(id, streams);
        return streams;

    } catch (e) {
        console.error(e);
    }
}

async function meta(einthusan_id) {
    try {
        var id = einthusan_id.split(":")[1];
        const Cached = MetaCache.get(id);
        if (Cached) return Cached;

        var url = `${baseURL}/movie/watch/${id}/`;
        console.log("url", url);
        var res = await request(url);
        if (!res || !res.data) throw "error requesting metadata";
        var html = parse(res.data);

        var movie_description = html.querySelector("#UIMovieSummary").querySelector("li");
        var img = movie_description.querySelector("div.block1 a img").rawAttributes['src'];
        var year = movie_description.querySelector("div.info p").childNodes[0].rawText;
        var title = movie_description.querySelector("a.title h3").rawText;
        var description = movie_description.querySelector("p.synopsis").rawText;
        //var genresarray = details[3].childNodes[2].querySelectorAll("a");
        var genresarray = [];

        var actorsarray = html.querySelectorAll("div.prof p");

        var trailer = html.querySelectorAll("div.extras a")[1];
        if (trailer.rawAttributes['href']) {
            trailer = trailer.rawAttributes['href'].split("v=")[1];
        } else {
            trailer = false;
        }

        var actors = [];
        if (actorsarray) {
            for (let i = 0; i < actorsarray.length; i++) {
                actors[i] = actorsarray[i].rawText;
            }
        }

        var genres = [];
        if (genresarray) {
            for (let i = 0; i < genresarray.length; i++) {
                genres[i] = genresarray[i].rawText;
            }
        }

        var metaObj = {
            id: einthusan_id,
            name: title,
            posterShape: 'poster',
            type: 'movie',
        };
        if (year) {
            metaObj.releaseInfo = year
        };
        if (img) {
            metaObj.poster = "https:" + img
        };
        if (img) {
            metaObj.background = "https:" + img
        };
        if (year) {
            metaObj.releaseInfo = year
        };
        if (genres) {
            metaObj.genres = genres
        };
        if (description) {
            metaObj.description = description
        };
        if (actors) {
            metaObj.cast = actors
        };
        //if (runtime){metaObj.runtime = runtime};
        if (trailer) {
            metaObj.trailers = [{
                source: trailer,
                type: "Trailer"
            }
            ]
        }
        if (metaObj) MetaCache.set(id, metaObj);
        //console.log("metaObj", metaObj);
        return metaObj;
    } catch (e) {
        console.error(e)
    }
}
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

async function search(lang, slug) {
    const CacheID = slug + "_" + lang
    slug = encodeURI(slug);

    lang = lang.substring(0, lang.length - 6);

    var url = `${baseURL}/movie/results/?lang=${lang}&query=${slug}`;
    console.log('search url:', url);
    var res = [];
    res = cache.get(CacheID);
    if (!res) {
        while (!res || res.length == 0) {
            //console.log('res:', res);
            res = await getcatalogresults(url);
            //res = await searchresults(url,lang,slug);
            //await sleep(5000);
        }
    }
    cache.set(CacheID, res);
    return res;

}
async function searchresults(url, lang, slug) {
    return request(
        url).then((res) => {
            if (res.status != 200) {
                return [];
            }
            var html = parse(res.data);
            //var search_results = html.querySelector('#UIMovieSummary');
            var search_results = html.querySelector("#UIMovieSummary");
            //console.log('search_results:', search_results, lang);
            if (search_results) {
                search_results = search_results.querySelectorAll("li");
            } else {
                return [];
            }
            var results_info = html.querySelector("div.results-info p").childNodes[0].rawText.split('Page ')[1].split(' of ')[1];
            if (results_info > 1) {
                results_info = 1;
            }
            return searchcatalog(lang, slug, results_info)
        }).catch(function (error) {
            return [];
        });
}
async function searchcatalog(lang, slug, pages) {
    var resultsarray = [];
    for (let i = 1; i <= pages; i++) {
        resultsarray[i - 1] = await getcatalog(lang, slug, i);
    }
    return resultsarray.flat();
}

async function getcatalog(lang, slug, page) {
    if (page == 1) {
        var url = `${baseURL}/movie/results/?lang=${lang}&query=${slug}`;
    } else {
        var url = `${baseURL}/movie/results/?lang=${lang}&page=${page}&query=${slug}`;
    }
    var cat = [];
    while (cat.length == 0) {
        //console.log('res:', cat);
        cat = await getcatalogresults(url);
        //await sleep(5000);
    }
    return cat;

}

async function getcatalogresults(url) {
    try {
        const Cached = CatalogCache.get(url);
        if(Cached) return Cached;

        let res = await request(url);
        if (!res || !res.data) throw "error";

        var html = parse(res.data);
        var search_results = html.querySelector("#UIMovieSummary");
        if (search_results) {
            search_results = search_results.querySelectorAll("li");
        } else {
            return [];
        }
        var resultsarray = [];
        for (let i = 0; i < search_results.length; i++) {
            var img = search_results[i].querySelector("div.block1 a img").rawAttributes['src'];
            var year = search_results[i].querySelector("div.info p").childNodes[0].rawText;
            var title = search_results[i].querySelector("a.title h3").rawText;
            var id = search_results[i].querySelector("a.title").rawAttributes['href'];
            resultsarray.push({
                id: "einthusan_id:" + id.split('/')[3],
                type: "movie",
                name: title,
                poster: "https:" + img,
                releaseInfo: year,
                posterShape: 'poster'
            })
        }
        if(resultsarray) CatalogCache.set(url,resultsarray);
        //console.log('resultsarray:', resultsarray);
        return resultsarray;

    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    search,
    meta,
    stream
};
