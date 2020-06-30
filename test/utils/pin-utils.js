'use strict'

const os = require('os')
const path = require('path')
const { nanoid } = require('nanoid')
const all = require('it-all')
const drain = require('it-drain')

exports.removeAllPins = async function removeAllPins (daemon) {
  const pins = await all(daemon.api.pin.ls())
  const rootPins = pins.filter(pin => pin.type === 'recursive' || pin.type === 'direct')

  await drain(daemon.api.pin.rm(rootPins.map(pin => pin.cid)))

  return daemon
}

exports.tmpPath = function tmpPath () {
  return path.join(os.tmpdir(), nanoid())
}
