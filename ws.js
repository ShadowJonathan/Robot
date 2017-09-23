const WebSocket = require('ws');
const Channel = require('channel');
const EventEmitter = require('events').EventEmitter;
const co = require('co');
const fs = require('fs');
const request = require('request');

//const AUTOMATIA_WS = 'ws://automatia.tk/ws';
const AUTOMATIA_WS = 'ws://localhost:8080/ws';

const AUTOMATIA_URL = "http://" + require('url').parse(AUTOMATIA_WS).host;

class Comms extends EventEmitter {
    constructor() {
        super();
        this.kickMachine = setInterval(this.kick.bind(this), 10000);
        this.ws = null;
        this.connected = false;
        this.in = new Channel(1000);

        try {
            this.uuid = String(fs.readFileSync('uuid'));
            this.ON(['login'], () => {
                this.send({ uuid: this.uuid });
                this.emit('connected');
            })
        } catch (err) {
            this.on('connect', () => {
                request(AUTOMATIA_URL + '/register', (e, r, b) => {
                    fs.writeFileSync('uuid', b);
                    this.uuid = b;
                    this.send({ uuid: this.uuid });
                    this.emit('connected');
                })
            })
        }
    }

    _handleMsg(message) {
        if (message.ping) {
            this.ws.send('{"pong":true}');
        } else {
            this.emit('message', message)
        }
    }

    /**
     * @param {Array.<String>} event
     * @param {Object} message
     */
    filter(event, message) {
        for (let p of event) {
            if (typeof p === "string") {
                if (message[p] === undefined) {
                    return false
                }
            } else {
                for (let k in p) {
                    if (message[k] != p[k]) {
                        return false
                    }
                }
            }
        }
        return true
    }

    ON(event, cb) {
        if (typeof event === 'string') {
            this.on(event, cb)
        } else {
            let f = m => {
                if (this.filter(event, m))
                    cb(m)
            };
            this.on('message', f.bind(this));
            return f
        }
    }

    ONCE(event, cb) {
        if (typeof event === 'string') {
            this.once(event, cb)
        } else {
            let f = m => {
                if (this.filter(event, m)) {
                    this.removeListener('message', f);
                    cb(m);
                }
            };
            this.on('message', f.bind(this));
        }
    }

    _startprocess() {
        co(function*() {
            while (this.online) {
                const v = yield this.in.recv();
                if (!v)
                    break;
                if (!this.online) {
                    this.in.send(v);
                    break;
                }
                console.log(v);
                this.ws.send(JSON.stringify(v))
            }
        }.bind(this))
    }

    send(o) {
        this.in.send(o)
    }

    resend(m) {
        this._handleMsg(m)
    }

    kick() {
        if (this.ws) return;
        try {
            this.ws = new WebSocket(AUTOMATIA_WS);
            this.ws.onclose = () => {
                this.ws = null;
                if (this.connected) {
                    this.emit('disconnect');
                    this.in.send(null)
                }
                this.connected = false
            };
            this.ws.onmessage = m => {
                this._handleMsg(JSON.parse(m.data))
            };
            this.ws.onopen = () => {
                this.connected = true;
                this._startprocess();
                this.emit('connect')
            };
            this.ws.onerror = (e) => console.error(e + "")
        } catch (err) {
            this.ws = null
        }
    }

    get online() {
        return this.connected
    }

    get DL_URL() {
        return AUTOMATIA_URL
    }
}

module.exports = Comms;