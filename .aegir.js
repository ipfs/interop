'use strict'

const parallel = require('async/parallel')
const ads = require('./test/utils/another-daemon-spawner')
const js = ads.spawnJsNode
const go = ads.spawnGoNode
const stop = ads.stopNodes

/*
 * spawns a daemon with ports numbers starting in 10 and ending in `num`
 */
function start (done) {
  const base = '/ip4/127.0.0.1/tcp'
  parallel([
    (cb) => go([`${base}/10027`, `${base}/20027/ws`], true, 33027, 44027, cb),
    (cb) => go([`${base}/10028`, `${base}/20028/ws`], true, 33028, 44028, cb),
    (cb) => go([`${base}/10031`, `${base}/20031/ws`], true, 33031, 44031, cb),
    (cb) => go([`${base}/10032`, `${base}/20032/ws`], true, 33032, 44032, cb)
  ], done)
}

module.exports = {
  karma: {
    files: [{
      pattern: 'node_modules/interface-ipfs-core/test/fixtures/**/*',
      watched: false,
      served: true,
      included: false,
      singleRun: false
    }]
  },
  hooks: {
    pre: start,
    post: stop
  }
}
