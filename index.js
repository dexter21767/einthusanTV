const express = require("express");
	app = express(),
	cors = require('cors'),
	path = require('path'),
	swStats = require('swagger-stats');

const langs = ["hindi", "tamil", "telugu", "malayalam", "kannada", "bengali", "marathi", "punjabi"],
	sources = require("./sources");
	config = require('./config.js');
	manifest = require("./manifest");

app.set('trust proxy', true)

app.use('/configure', express.static(path.join(__dirname, 'vue', 'dist')));
app.use('/assets', express.static(path.join(__dirname, 'vue', 'dist', 'assets')));

app.use(cors())

app.use(swStats.getMiddleware({
	name: manifest.name,
	version: manifest.version,
	authentication: true,
	onAuthenticate: function (req, username, password) {
		// simple check for username and password
		const User = process.env.USER ? process.env.USER : 'stremio'
		const Pass = process.env.PASS ? process.env.PASS : 'stremioIsTheBest'
		return ((username === User
			&& (password === Pass)))
	}
}));

console.log(`Swagger-Stats accessible at: ${config.local}/swagger-stats`)


app.get('/', (_, res) => {
	res.redirect('/configure/')
	res.end();
});

app.get('/:configuration?/configure/', (_, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('content-type', 'text/html');
	res.sendFile(path.join(__dirname, 'vue', 'dist', 'index.html'));
});

app.get('/manifest.json', (_, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');
	manifest.behaviorHints.configurationRequired = true;
	manifest.catalogs = [];
	res.send(manifest);
	res.end();
});

app.get('/:configuration?/manifest.json', (req, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');

	const { configuration } = req.params;
	manifest.behaviorHints.configurationRequired = false;
	manifest.catalogs = [{
		"type": "movie",

		"id": `${configuration}`,

		"name": `movies - ${configuration}`,

		"extra":
			[{
				"name": "search",
				"isRequired": true
			}
			]
	}];
	if (langs.includes(configuration)) res.send(manifest);
	res.end();
});

app.get('/:configuration?/catalog/movie/:id/:extra?.json', async (req, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');
	try {
		console.log(req.params);
		let { id, extra } = req.params;
		if (!langs.includes(id)) throw new Error("invalide catalog id") 
		if (extra) extra = new URLSearchParams(extra);
		console.log(extra)
		if (extra.has("search")) {
			console.log(extra.get("search"))
			await Promise.resolve(sources.search(id, extra.get("search")))
				.then((metas) => (res.send({ metas: metas })));
		} else res.send({ metas: [] })
		
		res.end();
	} catch (e) {
		console.log(e)
		res.end(JSON.stringify(e));
	}
})
app.get('/:configuration?/meta/movie/:id/:extra?.json', async (req, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');

	console.log(req.params);
	const { id } = req.params;

	if (id.startsWith("einthusan_id:")) {
		await Promise.resolve(sources.meta(id))
			.then((meta) => (res.send({ meta: meta })));
	} else res.send({ meta: [] })

	res.end();
})
app.get('/:configuration?/stream/movie/:id/:extra?.json', async (req, res) => {
	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');

	console.log(req.params);
	const { id } = req.params;

	if (id.startsWith("einthusan_id:")) {
		await Promise.resolve(sources.stream(id))
			.then((streams) => (res.send({ streams: [streams] })));

	} else res.send({ streams: [] })
	
	res.end();
})


module.exports = app
