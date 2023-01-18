/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createGo, createJs, createGoRelay, createJsRelay, randomWsAddr } from '../../utils/circuit.js'
import { getRelayV } from '../../utils/relayd.js'

/**
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

export default {

  // rv2 is a standalone, reference implementation of circuit relay v2
  // (https://github.com/libp2p/go-libp2p-relay-daemon)

  'go-rv2-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(2)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },

  'js-rv2-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(2)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  },

  'js-rv2-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(2)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },

  'go-rv2-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(2)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  },

  // relay v2 implementation in go-ipfs 0.11+

  'go-go-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },
  'js-go-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },
  'go-go-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  },
  'js-go-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createGoRelay([randomWsAddr], factory)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  },

  // relay v2 implementation in js-ipfs

  'go-js-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createJsRelay([randomWsAddr], factory)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },
  'js-js-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createJsRelay([randomWsAddr], factory)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory, relay)
      ])
    }
  },
  'go-js-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createJsRelay([randomWsAddr], factory)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  },
  'js-js-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await createJsRelay([randomWsAddr], factory)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory, relay)
      ])
    }
  }
}
