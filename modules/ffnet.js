/**
 * @type Comms
 */

const C = global.Comms;
var meta = require('persisted-json-object')({file: 'modules/ffnet.json'});
const state = require('./state');
const jsonfile = require('jsonfile');
if (meta.queue === undefined) {
    meta.queue = []
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
    meta.queue = []
});

class Story {

}

module.exports = {Story};