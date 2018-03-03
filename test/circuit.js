/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const parallel = require('async/parallel')
const series = require('async/series')

const isNode = require('detect-node')

const utils = require('./utils/circuit')

const proc = utils.setUpProcNode
const js = utils.setUpJsNode
const go = utils.setUpGoNode

const ws = utils.wsAddr
const star = utils.wsStarAddr
const circuit = utils.circuitAddr

const send = utils.send

const base = '/ip4/127.0.0.1/tcp/0'

const connect = (nodeA, nodeB, relay, callback) => {
  series([
    (cb) => nodeA.ipfsd.api.swarm.connect(ws(relay.addrs), cb),
    (cb) => setTimeout(cb, 1000),
    (cb) => nodeB.ipfsd.api.swarm.connect(ws(relay.addrs), cb),
    (cb) => setTimeout(cb, 1000),
    (cb) => nodeA.ipfsd.api.swarm.connect(circuit(nodeB.addrs), cb)
  ], callback)
}

const timeout = 30 * 1000

const baseTest = {
  connect,
  send,
  timeout
}

let tests = {
  'js-go-js': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback)
  },
  'go-go-js': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback)
  },
  'go-go-go': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb)
    ], callback)
  },
  'go-js-go': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb)
    ], callback)
  },
  'js-js-go': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'js-js-js': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback),
    timeout: 50 * 1000
  }
}

const browser = {
  'browser-go-js': {
    create:
      (callback) => series([
        (cb) => proc([], cb),
        (cb) => go([`${base}/ws`], cb),
        (cb) => js([`${base}/ws`], cb)
      ], callback),
    timeout: 50 * 1000
  },
  'browser-go-go': {
    create: (callback) => series([
      (cb) => proc([], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'browser-js-js': {
    create: (callback) => series([
      (cb) => proc([], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'browser-js-go': {
    create: (callback) => series([
      (cb) => proc([], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'js-go-browser': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => proc([], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'go-go-browser': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => go([`${base}/ws`], cb),
      (cb) => proc([], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'js-js-browser': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => proc([], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'go-js-browser': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => js([`${base}/ws`], cb),
      (cb) => proc([], cb)
    ], callback),
    timeout: 50 * 1000
  },
  'go-browser-browser': {
    create: (callback) => series([
      (cb) => go([`${base}/ws`], cb),
      (cb) => setTimeout(cb, 2000),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => setTimeout(cb, 2000),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(ws(nodeA.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => relay.ipfsd.api.swarm.connect(star(nodeB.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => nodeA.ipfsd.api.swarm.connect(circuit(nodeB.addrs), cb)
      ], callback)
    },
    timeout: 80 * 1000
  },
  'js-browser-browser': {
    create: (callback) => series([
      (cb) => js([`${base}/ws`], cb),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(ws(nodeA.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => relay.ipfsd.api.swarm.connect(star(nodeB.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => nodeA.ipfsd.api.swarm.connect(circuit(nodeB.addrs), cb)
      ], callback)
    },
    timeout: 80 * 1000
  },
  'browser-browser-go': {
    create: (callback) => series([
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => go([`${base}/ws`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(star(nodeA.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => relay.ipfsd.api.swarm.connect(ws(nodeB.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => nodeA.ipfsd.api.swarm.connect(circuit(nodeB.addrs), cb)
      ], callback)
    },
    timeout: 80 * 1000
  },
  'browser-browser-js': {
    create: (callback) => series([
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => proc([`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`], cb),
      (cb) => js([`${base}/ws`], cb)
    ], callback),
    connect: (nodeA, nodeB, relay, callback) => {
      series([
        (cb) => relay.ipfsd.api.swarm.connect(star(nodeA.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => relay.ipfsd.api.swarm.connect(ws(nodeB.addrs), cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => nodeA.ipfsd.api.swarm.connect(circuit(nodeB.addrs), cb)
      ], callback)
    }
  },
  timeout: 80 * 1000
}

describe.only('circuit', () => {
  if (!isNode) {
    tests = Object.assign([], tests, browser)
  }

  Object.keys(tests).forEach((test) => {
    let nodes
    let nodeA
    let relay
    let nodeB

    tests[test] = Object.assign({}, baseTest, tests[test])
    const dsc = tests[test].skip && tests[test].skip() ? describe.skip : describe
    dsc(test, function () {
      this.timeout(tests[test].timeout)

      before((done) => {
        tests[test].create((err, _nodes) => {
          nodes = _nodes.map((n) => n.ipfsd)
          nodeA = _nodes[0]
          relay = _nodes[1]
          nodeB = _nodes[2]
          done()
        })
      })

      after((done) => parallel(nodes.map((ipfsd) => (cb) => ipfsd.stop(cb)), done))

      it('connect', (done) => {
        tests[test].connect(nodeA, nodeB, relay, done)
      })

      it('send', (done) => {
        tests[test].send(nodeA.ipfsd.api, nodeB.ipfsd.api, done)
      })
    })
  })
})
