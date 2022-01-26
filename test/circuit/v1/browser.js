/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import delay from 'delay'
import { isWebWorker } from 'wherearewe'
import {
  createJs,
  createGo,
  createGoRelay,
  createProc,
  connWithTimeout,
  randomWsAddr,
  getWsAddr,
  getWrtcStarAddr
} from '../../utils/circuit.js'

export default {
  'browser-go-js': {
    skip: () => true, // FIXME when we have circuit v2 in js-ipfs and webrtc signaling
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createProc([], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    },
    connect: connWithTimeout(1500)
  },
  'browser-go-go': {
    skip: () => true, // FIXME when we have circuit v2 in js-ipfs and webrtc signaling
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createProc([], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    },
    connect: connWithTimeout(1500)
  },
  'browser-js-js': {
    create: (factory) => Promise.all([
      createProc([], factory),
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'browser-js-go': {
    create: (factory) => Promise.all([
      createProc([], factory),
      createJs([randomWsAddr], factory),
      createGo([randomWsAddr], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'js-go-browser': {
    skip: () => true, // FIXME when we have circuit v2 in js-ipfs and webrtc signaling
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createProc([], factory, relay)
      ])
    },
    connect: connWithTimeout(1500)
  },
  'go-go-browser': {
    skip: () => true, // FIXME when we have circuit v2 in js-ipfs and webrtc signaling
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createProc([], factory)
      ])
    },
    connect: connWithTimeout(1500)
  },
  'js-js-browser': {
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createProc([], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'go-js-browser': {
    create: (factory) => Promise.all([
      createGo([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createProc([], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'go-browser-browser': {
    create: (factory) => Promise.all([
      createGo([randomWsAddr], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory)
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWsAddr(nodeA.api))
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      const nodeBCircuitAddr = `${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => true // go-ipfs does not know what p2p-webrtc-star is
  },
  'js-browser-browser': {
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory)
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWsAddr(nodeA.api))
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = `${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => isWebWorker // no webrtc support in webworkers
  },
  'browser-browser-go': {
    create: (factory) => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createGo([randomWsAddr], factory)
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeA.api))
      await relay.api.swarm.connect(await getWsAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(5000)
      const nodeBCircuitAddr = `${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => isWebWorker // no webrtc support in webworkers
  },
  'browser-browser-js': {
    create: (factory) => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createJs([randomWsAddr], factory)
    ]),
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeA.api))
      await relay.api.swarm.connect(await getWsAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = `${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => isWebWorker // no webrtc support in webworkers
  }
}
