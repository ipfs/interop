/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import delay from 'delay'
import { isWebWorker } from 'wherearewe'
import {
  createJs,
  createProc,
  connWithTimeout,
  randomWsAddr,
  getWsAddr,
  getWrtcStarAddr
} from '../../utils/circuit.js'
import { multiaddr } from '@multiformats/multiaddr'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

export default {
  'browser-js-js': {
    /**
     * @param {Factory} factory
     */
    create: (factory) => Promise.all([
      createProc([], factory),
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'js-js-browser': {
    /**
     * @param {Factory} factory
     */
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createProc([], factory)
    ]),
    connect: connWithTimeout(1500)
  },
  'js-browser-browser': {
    /**
     * @param {Factory} factory
     */
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/ws/p2p-webrtc-star'], factory)
    ]),
    /**
     * @param {Controller} nodeA
     * @param {Controller} nodeB
     * @param {Controller} relay
     */
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWsAddr(nodeA.api))
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = multiaddr(`${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${(await nodeB.api.id()).id.toString()}`)
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => isWebWorker // no webrtc support in webworkers
  },
  'browser-browser-js': {
    /**
     * @param {Factory} factory
     */
    create: (factory) => Promise.all([
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createProc(['/ip4/127.0.0.1/tcp/24642/wss/p2p-webrtc-star'], factory),
      createJs([randomWsAddr], factory)
    ]),
    /**
     * @param {Controller} nodeA
     * @param {Controller} nodeB
     * @param {Controller} relay
     */
    connect: async (nodeA, nodeB, relay) => {
      await relay.api.swarm.connect(await getWrtcStarAddr(nodeA.api))
      await relay.api.swarm.connect(await getWsAddr(nodeB.api))
      // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
      await delay(3000)
      const nodeBCircuitAddr = multiaddr(`${await getWrtcStarAddr(relay.api)}/p2p-circuit/p2p/${(await nodeB.api.id()).id.toString()}`)
      await nodeA.api.swarm.connect(nodeBCircuitAddr)
    },
    skip: () => isWebWorker // no webrtc support in webworkers
  }
}
