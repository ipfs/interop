'use strict'

const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

const spawnInitAndStartDaemon = (factory) => {
  return new Promise((resolve, reject) => {
    factory.spawn({
      initOptions: {
        bits: 1024
      }
    }, (error, instance) => {
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
  spawnInitAndStartGoDaemon: () => spawnInitAndStartDaemon(goDf),
  spawnInitAndStartJsDaemon: () => spawnInitAndStartDaemon(jsDf),
  stopDaemon
}
