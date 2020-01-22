'use strict'

const os = require('os')
const path = require('path')
const hat = require('hat')
const all = require('it-all')

exports.removeAllPins = async function removeAllPins (daemon) {
  const pins = await all(daemon.api.pin.ls())
  const rootPins = pins.filter(pin => pin.type === 'recursive' || pin.type === 'direct')

  await Promise.all(rootPins.map(pin => daemon.api.pin.rm(pin.cid)))

  return daemon
}

exports.tmpPath = function tmpPath () {
  return path.join(os.tmpdir(), hat())
}
