const express = require("express"),
	app = express(),
	cors = require('cors'),
	path = require('path'),
	swStats = require('swagger-stats'),
	serveIndex = require('serve-index');


const langs = ["hindi", "tamil", "telugu", "malayalam", "kannada", "bengali", "marathi", "punjabi"],
	sources = require("./sources"),
	config = require('./config'),
	manifest = require("./manifest");

app.set('trust proxy', true)

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

app.use((req, res, next) => {
	req.setTimeout(15 * 1000); // timeout time
	req.socket.removeAllListeners('timeout');
	req.socket.once('timeout', () => {
		req.timedout = true;
		res.status(504).end();
	});
	if (!req.timedout) next()
});

console.log(`Swagger-Stats accessible at: ${config.local}/swagger-stats`)

app.use('/logs', express.static(path.join(__dirname, 'logs'), { etag: false }), serveIndex('logs', { 'icons': true, 'view': 'details ' }))

app.use('/configure', express.static(path.join(__dirname, 'vue', 'dist')));
app.use('/assets', express.static(path.join(__dirname, 'vue', 'dist', 'assets')));

app.use(cors())

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
		let metas;
		if (!langs.includes(id)) {
			id = id.split('movies')[0];
			if (!id || !langs.includes(id)) throw new Error("invalide catalog id");
		}
		if (extra) extra = new URLSearchParams(extra);
		console.log(extra)
		if (extra.has("search")) {
			console.log(extra.get("search"))
			metas = await sources.search(id, extra.get("search"))
		}
		if (metas) res.send({ metas: metas })
		else res.send({ metas: [] })
		res.end();

	} catch (e) {
		console.error(e)
	}
})
app.get('/:configuration?/meta/movie/:id/:extra?.json', async (req, res) => {

	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');
	try {
		console.log(req.params);
		const { id } = req.params;
		let meta;
		if (id.startsWith("einthusan_id:")) {
			meta = await sources.meta(id)
		}
		if (meta) res.send({ meta: meta })
		else res.send({ meta: [] })
		res.end();

	} catch (e) {
		console.error(e)
	}
})
app.get('/:configuration?/stream/movie/:id/:extra?.json', async (req, res) => {

	res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
	res.setHeader('Content-Type', 'application/json');
	try {
		console.log(req.params);
		const { id } = req.params;
		let streams;

		if (id.startsWith("einthusan_id:")) {
			streams = await sources.stream(id)
		}

		if (streams) res.send({ streams: streams })
		else res.send({ streams: [] })
		res.end();

		res.end();
	} catch (e) {
		console.error(e)
	}
})


module.exports = app
