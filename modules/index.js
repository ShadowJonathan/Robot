module.exports = {
    ffnet: require('./ffnet'),

    state: require('./state'),
    meta: require('persisted-json-object')({file: 'modules/meta.json'})
};