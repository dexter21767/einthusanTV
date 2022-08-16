const needle = require("needle");
const { parse } = require("fast-html-parser");
var URLSafeBase64 = require('urlsafe-base64');

const baseURL = "https://einthusan.tv";

const { default: axios } = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const jar = new CookieJar();
	const client = wrapper(axios.create({ 
		jar 
		}
	));
async function request(url,data) {
	
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
	var id = einthusan_id.split(":")[1];
	return request(" https://einthusan-cli.herokuapp.com/api/info?url="+`${baseURL}/movie/watch/${id}/`)
	.then((res) => {
		streams={  name: 'einthusan',
			   description: 'einthusan',
			  url: res.data.info.url};
		//console.log('res',res.data.info.url);
	return streams;
	});
}


async function meta(einthusan_id) {

	var id = einthusan_id.split(":")[1];

	var url = `${baseURL}/movie/watch/${id}/`;
	//console.log("url", url);
	return request(
    url,
  ).then((res) => {
    var html = parse(res.data);
	var movie_description = html.querySelector("#UIMovieSummary").querySelector("li");
	var img = movie_description.querySelector("div.block1 a img").rawAttributes['src'];
	var year = movie_description.querySelector("div.info p").childNodes[0].rawText ;
	var title =  movie_description.querySelector("a.title").rawText;
	var description = movie_description.querySelector("p.synopsis").rawText;	 
	//var genresarray = details[3].childNodes[2].querySelectorAll("a");
	var genresarray = [];
	
	var actorsarray = html.querySelectorAll("div.prof p");
	/*trailer = html.querySelector("div.TrailerCode iframe");
	if (trailer){
		trailer = trailer.rawAttributes['data-ifr'];
		if (trailer){
			trailer = trailer.split('/embed/')[1];
		}
	}*/

	var actors=[];
	if (actorsarray)
	{ 
		for (let i = 0; i < actorsarray.length; i++) 
		{	
			actors[i]=actorsarray[i].rawText;
		}
	}
	
	var genres=[];
	if (genresarray)
	{ 
		for (let i = 0; i < genresarray.length; i++) 
		{
			genres[i]=genresarray[i].rawText;
		}
	}
	
	var metaObj = {
            id: einthusan_id,
            name: title,
            posterShape: 'poster',
            type: 'movie',
        };
	if (year){metaObj.releaseInfo = year};
	if (img){metaObj.poster = "https:" + img};
	if (year){metaObj.releaseInfo = year};
	if (genres){metaObj.genres = genres};
	if (description){metaObj.description = description};
	if (actors){metaObj.cast = actors}; 
	//if (runtime){metaObj.runtime = runtime};
	//if (trailer){metaObj.trailers = { "source": trailer, "type": "Trailer" }};
	 
	console.log("metaObj", metaObj);
	 return metaObj;
	 });
	
}





async function search(lang, slug) {
	slug = encodeURI(slug);
		lang= lang.substring(0, lang.length - 6);
	var url = `${baseURL}/movie/results/?lang=${lang}&query=${slug}`;
	return request(
	url
  ).then((res) => {
    var html = parse(res.data);
	var search_results = html.querySelector("#UIMovieSummary");
	if (search_results){
	search_results = search_results.querySelectorAll("li");	
	}
	else{
		return;
	}
	 var results_info = html.querySelector("div.results-info p").childNodes[0].rawText.split('Page ')[1].split(' of ')[1];
	return searchcatalog(lang, slug,results_info).then((res) => {
	return res;
	
	
	
	 })
	 });
	
}
async function searchcatalog(lang, slug,pages){
	var resultsarray = [];
	for (let i = 1; i <= pages; i++) {
		resultsarray[i-1] =  await getcatalog(lang, slug,i);	
	}
	return resultsarray.flat();
}
async function getcatalog(lang, slug,page){
	 if (page == 1){
	var url = `${baseURL}/movie/results/?lang=${lang}&query=${slug}`;
	 }
	 else{
		 var url = `${baseURL}/movie/results/?lang=${lang}&page=${page}&query=${slug}`;
	 }
	return request(
	url
  ).then((res) => {
    var html = parse(res.data);
	var search_results = html.querySelector("#UIMovieSummary");
	if (search_results){
	search_results = search_results.querySelectorAll("li");	
	}
	else{
		return;
	}	
	var resultsarray = [];
		 for (let i = 0; i < search_results.length; i++) {
			 var img = search_results[i].querySelector("div.block1 a img").rawAttributes['src'];
			 var year = search_results[i].querySelector("div.info p").childNodes[0].rawText ;
			 var title =  search_results[i].querySelector("a.title").rawText;
			 var id =  search_results[i].querySelector("a.title").rawAttributes['href'];
			  resultsarray.push(
				{
					id: "einthusan_id:"+id.split('/')[3],
					type: "movie",
					name: title, 
					poster: "https:" + img,
					releaseInfo: year, 
					posterShape: 'poster'
				}
			)
	}
	
	 return resultsarray;
	  });
}

module.exports = {search,meta,stream};