'use strict'

const mergeOptions = require('merge-options')
const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

const spawnInitAndStartDaemon = (factory, options) => {
  options = mergeOptions({
    initOptions: {
      bits: 1024
    },
    config: {
      Bootstrap: [],
      Discovery: {
        MDNS: {
          Enabled: false
        },
        webRTCStar: {
          Enabled: false
        }
      },
      // enabled sharding for go
      Experimental: {
        ShardingEnabled: true
      }
    },
    // enabled sharding for js
    args: factory.options.type === 'js' ? [
      '--enable-sharding-experiment'
    ] : undefined,
    profile: 'test'
  }, options)

  return new Promise((resolve, reject) => {
    factory.spawn(options, (error, instance) => {
      if (error) {
        return reject(error)
      }

      resolve(instance)
    })
  })
}

const stopDaemon = (daemon) => {
  return new Promise((resolve, reject) => {
    daemon.stop((error) => {
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
}

module.exports = {
  spawnInitAndStartDaemon,
  spawnInitAndStartGoDaemon: (opts) => spawnInitAndStartDaemon(goDf, opts),
  spawnInitAndStartJsDaemon: (opts) => spawnInitAndStartDaemon(jsDf, opts),
  stopDaemon
}
