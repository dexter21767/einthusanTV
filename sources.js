const { parse } = require("fast-html-parser");
const youtubedl = require("youtube-dl-exec");
const config = require('./config');
require('dotenv').config();

const axios = require('axios').default;


const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const StreamCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const MetaCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });
const CatalogCache = new NodeCache({ stdTTL: (0.5 * 60 * 60), checkperiod: (1 * 60 * 60) });



client = axios.create({
    baseURL: config.BaseURL,
    timeout: 5000
});


async function request(url) {
    try {
        return await client
            .get(url)
    } catch (e) {
        console.error(e);
    }
}

async function stream(einthusan_id) {
    try {
        var id = einthusan_id.split(":")[1];
        const Cached = StreamCache.get(id);
        if (Cached) return Cached;

        let url = `${config.BaseURL}/movie/watch/${id}/`;
        /*
        console.log(youtubedl.args(url,{
            dumpSingleJson: true,
            simulate: true,
            skipDownload: true,
            noDownload:true,
        }));
        */
        let info = await youtubedl(url, {
            dumpSingleJson: true,
            simulate: true,
            skipDownload: true,
            noDownload: true,
        });
        //console.log(info)
        if (!info) throw "error on youtubedl";

        let streams = {
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

        var url = `/movie/watch/${id}/`;
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

async function search(lang, slug) {
    try {
        const CacheID = slug + "_" + lang
        slug = encodeURI(slug);

        lang = lang.substring(0, lang.length - 6);

        const url = `/movie/results/?lang=${lang}&query=${slug}`;
        console.log('search url:', url);
        let res = [];
        res = cache.get(CacheID);
        if (!res) {
            while (!res || res.length == 0) {
                res = await getcatalogresults(url);
            }
        }
        cache.set(CacheID, res);
        return res;
    } catch (e) {
        console.error(e);
    }
}

async function getcatalogresults(url) {
    try {
        const Cached = CatalogCache.get(url);
        if (Cached) return Cached;

        let res = await request(url);
        if (!res || !res.data) throw "error getcatalogresults";
        var html = parse(res.data);
        var search_results = html.querySelector("#UIMovieSummary");
        //console.log("search_results",search_results)
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
        if (resultsarray) CatalogCache.set(url, resultsarray);
        console.log('resultsarray:', resultsarray);
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
