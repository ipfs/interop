/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const series = require('async/series')

const utils = require('../utils/circuit')

const createJs = utils.createJsNode
const createGo = utils.createGoNode

const base = '/ip4/127.0.0.1/tcp/0'

module.exports = {
  'go-go-go': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback)
  },
  'js-go-go': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback)
  },
  'go-go-js': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback)
  },
  'js-go-js': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback)
  },
  'go-js-go': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback)
  },
  'js-js-go': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback)
  },
  'go-js-js': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback)
  },
  'js-js-js': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback)
  }
}
