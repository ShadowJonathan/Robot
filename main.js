require('events').EventEmitter.defaultMaxListeners = 100;
if (parseInt(/v(\d+)/.exec(process.version)[1]) < 8) throw new Error("NODE VERSION UNDER 8");
const express = require('express');
const http = require('http');
const url = require('url');
const jsonfile = require('jsonfile');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const router = express.Router();
const api = require('termux-api');
require('mkdirp').sync('cache');
var runningJobs = global.runningJobs = require('persisted-json-object')({ file: 'cache/jobs.json' });
if (!runningJobs.waiting) {
    runningJobs.waiting = {};
}
/**
 * @type {Comms}
 */
const Comms = global.Comms = new(require('./ws'))();
modules = require('./modules');

Comms.setMaxListeners(0);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

Comms.on('error', console.log);
Comms.on('connect', () => console.log("Connected!"));
Comms.on('connected', () => console.log("Logged in!"));
Comms.on('disconnect', () => console.log("Disconnected!"));
Comms.on('message', console.log);

var kickbacks = {};

app.use(router);
try {
    app.use('/static', express.static(__dirname + '/static'));
} catch (err) {}
router.post('/kickback', (r, rp) => {
    console.log(r.body);
    rp.send()
});

server.listen(8000, (e) => console.log(e));

// START APP