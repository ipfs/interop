/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const series = require('async/series')

const utils = require('../utils/circuit')

const createJs = utils.createJsNode
const createProc = utils.createProcNode
const createGo = utils.createGoNode
const connWithTimeout = utils.connWithTimeout

const getWsAddr = utils.getWsAddr
const getWsStarAddr = utils.getWsStarAddr
const getCircuitAddr = utils.getCircuitAddr

const base = '/ip4/127.0.0.1/tcp/0'

module.exports = {
  'browser-go-js': {
    create:
      (callback) => series([
        (cb) => createProc([], cb),
        (cb) => createGo([`${base}/ws`], cb),
        (cb) => createJs([`${base}/ws`], cb)
      ], callback),
    connect: connWithTimeout(1500)
  },
  'browser-go-go': {
    create: (callback) => series([
      (cb) => createProc([], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'browser-js-js': {
    create: (callback) => series([
      (cb) => createProc([], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'browser-js-go': {
    create: (callback) => series([
      (cb) => createProc([], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'js-go-browser': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createProc([], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'go-go-browser': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createProc([], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'js-js-browser': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createProc([], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'go-js-browser': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createProc([], cb)
    ], callback),
    connect: connWithTimeout(1500)
  },
  'go-browser-browser': {
    create: (callback) => series([
      (cb) => createGo([`${base}/ws`], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(getWsAddr(nodeA.addrs), cb),
        (cb) => relay.ipfsd.api.swarm.connect(getWsStarAddr(nodeB.addrs), cb),
        // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
        (cb) => setTimeout(cb, 5000),
        (cb) => nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs), cb)
      ], callback)
    },
    skip: () => false
  },
  'js-browser-browser': {
    create: (callback) => series([
      (cb) => createJs([`${base}/ws`], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(getWsAddr(nodeA.addrs), cb),
        (cb) => relay.ipfsd.api.swarm.connect(getWsStarAddr(nodeB.addrs), cb),
        // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
        (cb) => setTimeout(cb, 3000),
        (cb) => nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs), cb)
      ], callback)
    }
  },
  'browser-browser-go': {
    create: (callback) => series([
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createGo([`${base}/ws`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(getWsStarAddr(nodeA.addrs), cb),
        (cb) => relay.ipfsd.api.swarm.connect(getWsAddr(nodeB.addrs), cb),
        // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
        (cb) => setTimeout(cb, 5000),
        (cb) => nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs), cb)
      ], callback)
    }
  },
  'browser-browser-js': {
    create: (callback) => series([
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star'], cb),
      (cb) => createJs([`${base}/ws`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(getWsStarAddr(nodeA.addrs), cb),
        (cb) => relay.ipfsd.api.swarm.connect(getWsAddr(nodeB.addrs), cb),
        // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
        (cb) => setTimeout(cb, 3000),
        (cb) => nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs), cb)
      ], callback)
    }
  }
}
