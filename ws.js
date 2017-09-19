const WebSocket = require('ws');
const Channel = require('channel');

const AUTOMATIA_URL = 'ws://83.162.42.242/ws';

class Comms {
    constructor() {
        this.kickMachine = setInterval(this.kick, 10000);
        this.ws = null;
        this.in = Channel(1000);
        this.out = Channel(1000);
    }

    _handleMsg(message) {
        if (message.ping) {
            this.ws.send('{"pong":true}')

        }
    }

    kick() {
        try {
            this.ws = new WebSocket(AUTOMATIA_URL);
            this.ws.onclose = () => {this.ws = null; this.in.close()};
            this.ws.onmessage = m => this._handleMsg(JSON.parse(m));
            this.ws.onopen = () => {this.in = Channel(1000)};
        } catch (err) {
            this.ws = null
        }
    }
}

module.exports = {Comms};