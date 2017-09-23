/**
 * @type Comms
 */
const C = global.Comms;
var meta = require('persisted-json-object')({ file: 'modules/download.json' });
const request = require('request');
const fs = require('fs');
if (!meta.queue) {
    meta.queue = {}
}

C.on('connected', () => {

});

class Download {
    constructor(url, file, id, module) {
        meta.queue[id] = { url, file, module, id };
        Download.DO(meta.queue[id])
    }

    static DO(params) {
        request
            .get(params.url)
            .on('error', function(err) {
                console.log(err)
            })
            .pipe(fs.createWriteStream(params.file))
            .on('finish', () => require('./../modules')[params.module].dl_callback(params.id))
    }

    static get BASE() {
        return C.DL_URL;
    }
}

module.exports = Download;