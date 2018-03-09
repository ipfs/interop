'use strict'

const os = require('os')
const path = require('path')
const hat = require('hat')

exports.removeAllPins = function removeAllPins (daemon) {
  return daemon.api.pin.ls()
    .then(pins => {
      const rootPins = pins.filter(
        pin => pin.type === 'recursive' || pin.type === 'direct'
      )
      return Promise.all(rootPins.map(pin => daemon.api.pin.rm(pin.hash)))
    })
    .then(() => daemon)
}

exports.stopDaemons = function stopDaemons (daemons) {
  return Promise.all(
    daemons.map(daemon => new Promise((resolve, reject) =>
      daemon.stop(err => err ? reject(err) : resolve())
    ))
  )
}

exports.tmpPath = function tmpPath () {
  return path.join(os.tmpdir(), hat())
}
