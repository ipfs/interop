'use strict'

const os = require('os')
const path = require('path')
const hat = require('hat')
const waterfall = require('async/waterfall')
const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

const spawnInitAndStartDaemon = (factory) => {
  const dir = path.join(os.tmpdir(), hat())
  let instance

  return new Promise((resolve, reject) => {
    waterfall([
      (cb) => factory.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: {
          bits: 1024
        }
      }, cb),
      (node, cb) => {
        instance = node
        instance.init(cb)
      },
      (_, cb) => instance.start((error) => cb(error, instance))
    ], (error) => {
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
