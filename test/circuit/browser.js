/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const delay = require('delay')

const {
  createJs,
  createGo,
  createProc,
  connWithTimeout,
  getWsAddr,
  getWrtcStarAddr,
  getCircuitAddr
} = require('../utils/circuit')

const base = '/ip4/127.0.0.1/tcp/0'

module.exports = {
  'browser-go-js': {
    create: () => Promise.all([
      createProc([]),
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`])
    ]),
    connect: connWithTimeout(1500)
  },
  'browser-go-go': {
    create: () => Promise.all([
      createProc([]),
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`])
    ]),
    connect: connWithTimeout(1500)
  },
  'browser-js-js': {
    create: () => Promise.all([
      createProc([]),
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`])
    ]),
    connect: connWithTimeout(1500)
  },
  'browser-js-go': {
    create: () => Promise.all([
      createProc([]),
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`])
    ]),
    connect: connWithTimeout(1500)
  },
  'js-go-browser': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createProc([])
    ]),
    connect: connWithTimeout(1500)
  },
  'go-go-browser': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createProc([])
    ]),
    connect: connWithTimeout(1500)
  },
  'js-js-browser': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createProc([])
    ]),
    connect: connWithTimeout(1500)
  },
  'go-js-browser': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createProc([])
    ]),
    connect: connWithTimeout(1500)
  },
  'go-browser-browser': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.ipfsd.api.swarm.connect(getWsAddr(nodeA.addrs))
      await relay.ipfsd.api.swarm.connect(getWrtcStarAddr(nodeB.addrs))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      await nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs))
    }
  },
  'js-browser-browser': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.ipfsd.api.swarm.connect(getWsAddr(nodeA.addrs))
      await relay.ipfsd.api.swarm.connect(getWrtcStarAddr(nodeB.addrs))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      await nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs))
    },

  },
  'browser-browser-go': {
    create: () => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createGo([`${base}/ws`])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.ipfsd.api.swarm.connect(getWrtcStarAddr(nodeA.addrs))
      await relay.ipfsd.api.swarm.connect(getWsAddr(nodeB.addrs))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      await nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs))
    }
  },
  'browser-browser-js': {
    create: () => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createJs([`${base}/ws`])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.ipfsd.api.swarm.connect(getWrtcStarAddr(nodeA.addrs))
      await relay.ipfsd.api.swarm.connect(getWsAddr(nodeB.addrs))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      await nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs))
    }
  }
}
