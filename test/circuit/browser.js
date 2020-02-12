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
  getWrtcStarAddr
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
      await relay.api.swarm.connect(getWsAddr(nodeA.api.peerId.addresses))
      await relay.api.swarm.connect(getWrtcStarAddr(nodeB.api.peerId.addresses))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      const nodeBCircuitAddr = `${getWrtcStarAddr(relay.api.peerId.addresses)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => true // go-ipfs does not know what p2p-webrtc-star is
  },
  'js-browser-browser': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(getWsAddr(nodeA.api.peerId.addresses))
      await relay.api.swarm.connect(getWrtcStarAddr(nodeB.api.peerId.addresses))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = `${getWrtcStarAddr(relay.api.peerId.addresses)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    }
  },
  'browser-browser-go': {
    create: () => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createGo([`${base}/ws`])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(getWrtcStarAddr(nodeA.api.peerId.addresses))
      await relay.api.swarm.connect(getWsAddr(nodeB.api.peerId.addresses))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      const nodeBCircuitAddr = `${getWrtcStarAddr(relay.api.peerId.addresses)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    }
  },
  'browser-browser-js': {
    create: () => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star']),
      createJs([`${base}/ws`])
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(getWrtcStarAddr(nodeA.api.peerId.addresses))
      await relay.api.swarm.connect(getWsAddr(nodeB.api.peerId.addresses))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = `${getWrtcStarAddr(relay.api.peerId.addresses)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    }
  }
}
