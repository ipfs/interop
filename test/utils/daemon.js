'use strict'

const mergeOptions = require('merge-options')
const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

const spawnDaemon = (factory, options) => {
  options = mergeOptions({
    initOptions: {
      bits: 1024
    },
    config: {
      Discovery: {
        MDNS: {
          Enabled: false
        },
        webRTCStar: {
          Enabled: false
        }
      }
    },
    profile: 'test'
  }, options)

  return factory.spawn(options)
}

const stopDaemon = (daemon) => daemon.stop()

module.exports = {
  spawnDaemon,
  spawnGoDaemon: (opts) => spawnDaemon(goDf, opts),
  spawnJsDaemon: (opts) => spawnDaemon(jsDf, opts),
  stopDaemon
}
