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
    timeout: 10000
});



async function stream(einthusan_id) {
    try {
        const id = einthusan_id.split(":")[1];
        const Cached = StreamCache.get(id);
        if (Cached) return Cached;

        let url = `${config.BaseURL}/movie/watch/${id}/`;

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
        return Promise.reject(e);
    }
}

async function meta(einthusan_id) {
    try {
        const id = einthusan_id.split(":")[1];
        const Cached = MetaCache.get(id);
        if (Cached) return Cached;

        const url = `/movie/watch/${id}/`;
        console.log("url", url);
        const res = await client.get(url);
        if (!res || !res.data) throw "error requesting metadata";
        const html = parse(res.data);

        const movie_description = html.querySelector("#UIMovieSummary").querySelector("li");
        const img = movie_description.querySelector("div.block1 a img").rawAttributes['src'];
        const year = movie_description.querySelector("div.info p").childNodes[0].rawText;
        const title = movie_description.querySelector("a.title h3").rawText;
        const description = movie_description.querySelector("p.synopsis").rawText;
        //var genresarray = details[3].childNodes[2].querySelectorAll("a");
        var genresarray = [];

        const actorsarray = html.querySelectorAll("div.prof p");

        let trailer = html.querySelectorAll("div.extras a")[1];
        if (trailer.rawAttributes['href']) {
            trailer = trailer.rawAttributes['href'].split("v=")[1];
        } else {
            trailer = false;
        }

        let actors = [];
        if (actorsarray) {
            for (let i = 0; i < actorsarray.length; i++) {
                actors[i] = actorsarray[i].rawText;
            }
        }

        let genres = [];
        if (genresarray) {
            for (let i = 0; i < genresarray.length; i++) {
                genres[i] = genresarray[i].rawText;
            }
        }

        let metaObj = {
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
        console.error(e);
        return Promise.reject(e);
    }
}

async function search(lang, slug) {
    try {
        const CacheID = slug + "_" + lang
        slug = encodeURI(slug);

        lang = lang.substring(0, lang.length - 6);

        const url = `/movie/results/?lang=${lang}&query=${slug}`;
        console.log('search url:', url);
        let res = cache.get(CacheID);
        if (!res) {
            while (!res || res.length == 0) {
                res = await getcatalogresults(url);
            }
        }
        cache.set(CacheID, res);
        return res;
    } catch (e) {
        console.error(e);
        return Promise.reject(e);
    }
}

async function getcatalogresults(url) {
    try {
        const Cached = CatalogCache.get(url);
        if (Cached) return Cached;

        const res = await client.get(url);
        if (!res || !res.data) throw "error getcatalogresults";
        const html = parse(res.data);
        let search_results = html.querySelector("#UIMovieSummary");
        //console.log("search_results",search_results)
        if (search_results) {
            search_results = search_results.querySelectorAll("li");
        } else {
            return [];
        }
        let resultsarray = [];
        for (let i = 0; i < search_results.length; i++) {
            const img = search_results[i].querySelector("div.block1 a img").rawAttributes['src'];
            const year = search_results[i].querySelector("div.info p").childNodes[0].rawText;
            const title = search_results[i].querySelector("a.title h3").rawText;
            const id = search_results[i].querySelector("a.title").rawAttributes['href'];
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
        return Promise.reject(e);
    }
}

module.exports = {
    search,
    meta,
    stream
};
