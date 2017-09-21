/**
 * @type Comms
 */
const C = global.Comms;
if (!('contains' in String.prototype)) {
    String.prototype.contains = function (str, startIndex) {
        return -1 !== String.prototype.indexOf.call(this, str, startIndex);
    };
}

var meta = require('persisted-json-object')({file: 'modules/ffnet.json'});
if (!meta.todownload) {
    meta.todownload = {}
}
if (!meta.jobs) {
    meta.jobs = {}
}
var runningJobs = global.runningJobs;
const PJO = require('persisted-json-object');
const Download = require('./download');
const events = require('events');
const mkdirp = require('mkdirp');
if (meta.queue === undefined) {
    meta.queue = []
}

function flush() {
    meta.flush = true;
    runningJobs.flush = true
}

var FSC = {};
var Stories = {};
var Categories = {};
var VALID_CATEGORIES = [
    'anime',
    'book',
    'cartoon',
    'game',
    'misc',
    'play',
    'movie',
    'tv'
];
var NAME2CAT = {
    "Anime/Manga": 'anime',
    "Books": 'book',
    "Cartoons": 'cartoon',
    "Games": 'game',
    "Misc": 'misc',
    "Plays/Musicals": 'play',
    "Movies": 'movie',
    "TV Shows": 'tv'
}
var Archives = {};

mkdirp.sync('cache/ffnet/stories');
mkdirp.sync('cache/ffnet/archives');

try {
    require('fs').mkdirSync('storage');
    require('fs').mkdirSync('storage/stories')
} catch (err) {

}

C.on('connected', () => {
    if (meta.queue.length > 0) {
        for (let e of meta.queue) {
            if (e.id)
                new Story(e.id)
        }
        C.send({orig: 'ffnet', queue: meta.queue})
    }
    if (!(Object.keys(meta.jobs).length === 0 && meta.jobs.constructor === Object)) {
        for (let k of Object.keys(meta.jobs)) {
            if (meta.jobs[k].dl)
                continue;
            let s = new Story(meta.jobs[k], k);
            let d = () => {
                C.send({orig: 'ffnet', get_job: true, j_id: k});
                C.ONCE(['job_result', {j_id: k}], m => {
                    if (m.job_result && typeof m.job_result != 'string') {
                        C.emit('message', m.job_result[0])
                    } else if (m.job_result == "WORKING") {
                        setTimeout(d, 7500)
                    } else if (m.job_result == null) {
                        s.download();
                        delete meta.jobs[k];
                        flush()
                    }
                })
            };
            d()
        }
    }
});

C.ON([{
    orig: 'ffnet',
    reg: 'queue',
    queue: 'accepted'
}], () => {
    meta.queue = []
});

C.ON([
    'meta',
    's_id',
    {orig: 'ffnet'}
], (m) => {
    Story.got_meta(m.meta)
});

function dl_callback(j_id) {
    delete meta.jobs[j_id];
    console.log(j_id, "done")
}

class Story extends events.EventEmitter {
    constructor(id, j_id) {
        super();
        id = String(id);
        id = /(?:(?:www|m)\.fanfiction\.net\/s\/)?(\d+)(?:\/\d+)?/.exec(id)[1];
        if (Stories[id]) {
            if (j_id)
                Stories[id].j_id = j_id;
            return Stories[id];
        }
        if (j_id)
            this.j_id = j_id;
        this.data = PJO({file: 'cache/ffnet/stories/' + id + '.json'});
        this.id = id;
        if (!this.data.storyID) {
            this.init = false;
            if (C.online)
                C.send({orig: 'ffnet', story_id: this.id, meta: true});
            else {
                meta.queue.push({id: this.id, meta: true});
                flush()
            }
        } else {
            this.init = true;
            this.last_update = new Date(this.data.l_u)
        }
        FSC[id] = this.data;
        Stories[id] = this;
        this.setupListeners();
    }

    setupListeners() {
        C.ON([
            {failed: true, fail_code: 1, orig: 'ffnet', s_id: this.id}
        ], m => {
            this.data.l_u = new Date();
            this.data.DOESNOTEXIST = true;
            delete runningJobs.waiting[this.j_id];
            delete meta.jobs[m.j_id];
            flush()
        });

        C.ON(
            [{orig: 'ffnet'}, 's_id', 'j_id'], (m) => {
                if (m.s_id != this.id)
                    return;
                runningJobs.waiting[m.j_id] = this.id;
                meta.jobs[m.j_id] = this.id;
                flush();
                this.j_id = m.j_id
            }
        );

        C.ON([{finished: true, s_id: this.id, orig: 'ffnet'}], m => {
            new Download(
                Download.BASE + "/" + m.file_name,
                "storage/stories/" + require('path').basename(m.file_name),
                this.j_id,
                'ffnet'
            );
            delete runningJobs.waiting[this.j_id];
            meta.jobs[this.j_id] = {dl: true, id: this.id};
            flush()
        })
    }

    download() {
        if (C.online)
            C.send({orig: 'ffnet', story_id: this.id, download: true});
        else {
            meta.queue.push({id: this.id});
            flush()
        }
    }

    /**
     * @param {Object} data
     * @param {String} data.storyID
     */
    static got_meta(data) {
        if (!FSC[data.storyID])
            FSC[data.storyID] = PJO({file: 'cache/ffnet/stories/' + data.storyID + '.json'});
        for (let p in data)
            FSC[data.storyID][p] = data[p]
        FSC[data.storyID].l_u = new Date();
        if (Stories[data.storyID]) {
            Stories[data.storyID].init = true
        }
    }
}

class Archive extends events.EventEmitter {
    constructor(cat, archive) {
        super();
        cat = cat.toLowerCase();
        archive = archive.toLowerCase().replace(/ /g, '-');
        if (!Categories[cat])
            throw Error("CATEGORY DOES NOT EXIST");
        this.cat = Categories[cat];
        if (!this.cat.hasArchive(archive))
            throw Error("ARCHIVE DOES NOT EXIST");
        if (this.cat.archives[archive])
            return Categories[cat].archives[archive];
        this.name = archive;
        Archives[cat + " > " + archive] = this;
        /**
         * @type {Proxy}
         * @property {Object} info
         */
        this.data = PJO({file: 'cache/ffnet/archives/' + archive + '.json'});
        if (!this.data.info) {
            let msg = {
                orig: 'ffnet', archive: true, a_url: cat + "/" + archive, info: true, category: this.name
            };
            if (C.online) {
                C.send(msg)
            } else {
                meta.queue.push(msg);
                flush()
            }
        } else {
            this.data.info.earliest = new Date(this.data.info.earliest);
            this.data.info.latest = new Date(this.data.info.latest);
        }

        Categories[cat].attach(this);
        this.setupListeners()
    }

    setupListeners() {
        C.ON([{orig: 'ffnet', archive: this.name, category: this.cat.name}, 'meta'], m => {
            if (!m.initialised) {
                C.send({
                    orig: 'ffnet',
                    archive: true,
                    a_url: this.cat.name + "/" + this.name,
                    getinfo: true,
                    category: this.name
                });
            } else {
                this.data.info = {
                    amount: m.amount,
                    earliest: new Date(m.earliest),
                    latest: new Date(m.latest),
                    meta: m.meta,
                }
            }
        })
    }
}

class Category {
    constructor(name) {
        this.name = name;
        Categories[name] = this;
        /**
         * @type {Proxy}
         * @property {Array} list
         */
        this.data = PJO({file: 'cache/ffnet/cat.' + name + '.json'});
        if (!this.data.list) {
            this.data.list = [];
            let msg = {orig: 'ffnet', archive: '?', category: this.name};
            if (C.online) {
                C.send(msg)
            } else {
                meta.queue.push(msg);
                flush()
            }
        }
        /**
         * @type {Object.<String,Archive>}
         */
        this.archives = {};
        this.setupListeners()
    }

    setupListeners() {
        C.ON([{orig: 'ffnet', meta: 'category', category: this.name}], m => {
            this.data.list = m.data;
            this.data.update = new Date();
            flush()
        });

        C.ON([{orig: 'ffnet', category: this.name, get_latest_date: true}], () => {
            C.send({orig: 'ffnet', latest_date: this.data.update, category: this.name})
        });
    }

    attach(archive) {
        this.archives[archive.name] = archive
    }

    hasArchive(name) {
        if (this.data.list.length == 0)
            return false;
        name = name.replace(/ /g, '-').toLowerCase();
        for (let a of this.data.list) {
            if (a.url.toLowerCase().contains(name)) {
                return true
            }
        }
        return false
    }
}

for (let c of VALID_CATEGORIES)
    new Category(c)

module.exports = {Story, Archive, FSC, Stories, Archives, Categories, VALID_CATEGORIES, NAME2CAT, dl_callback, meta};