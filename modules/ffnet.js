/**
 * @type Comms
 */
const C = global.Comms;
var meta = require('persisted-json-object')({file: 'modules/ffnet.json'});
const jsonfile = require('jsonfile');
const PJO = require('persisted-json-object');
if (meta.queue === undefined) {
    meta.queue = []
}

var FSC = {};
var Stories = {};

try {
    require('fs').mkdirSync('cache');
    require('fs').mkdirSync('cache/ffnet');
} catch (err) {
}

C.on('connected', () => {
    if (meta.queue.length > 0) {
        C.send({orig: 'ffnet', queue: meta.queue})
    }
});

C.ON([{
    orig: 'ffnet',
    reg: 'queue',
    queue: 'accepted'
}], () => {
    meta.queued = meta.queue;
    meta.queue = []
});

C.ON([
    'meta',
    {orig: 'ffnet'}
], (m) => {
    Story.got_meta(m.meta)
});

class Story {
    constructor(id) {
        id = String(id);
        if (Stories[id])
            return Stories[id];
        this.data = PJO({file: 'cache/ffnet/' + id + '.json'});
        if (!this.data.id) {
            this.init = false;
        } else {
            this.init = true;
            this.last_update = new Date(this.data.l_u)
        }
        FSC[id] = this.data;
        Stories[id] = this;
        C.ON([
            {failed: true, fail_code: 1, orig: 'ffnet', s_id: id}
        ], m => {
            this.data.l_u = new Date();
            this.data.DOESNOTEXIST = true
        });

       /* C.ON([ // TODO make on completion and cut-off handling & download
            {}
            ]
        )*/
    }

    static got_meta(data) {
        if (!FSC[data.storyID])
            FSC[data.storyID] = PJO({file: 'cache/ffnet/' + data.storyID + '.json'})
        for (let p in data)
            FSC[data.storyID][p] = data[p]
        FSC[data.storyID].l_u = new Date()
    }
}

module.exports = {Story, FSC};