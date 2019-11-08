'use strict'

const os = require('os')
const path = require('path')
const hat = require('hat')

exports.removeAllPins = async function removeAllPins (daemon) {
  const pins = await daemon.api.pin.ls()
  const rootPins = pins.filter(pin => pin.type === 'recursive' || pin.type === 'direct')

  await Promise.all(rootPins.map(pin => daemon.api.pin.rm(pin.hash)))

  return daemon
}

exports.tmpPath = function tmpPath () {
  return path.join(os.tmpdir(), hat())
}
