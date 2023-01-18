/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createJs, createGo, randomWsAddr } from '../../utils/circuit.js'
import { getRelayV } from '../../utils/relayd.js'

/**
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

export default {

  // rv1 is a standalone, reference implementation of circuit relay v1
  // (https://github.com/libp2p/go-libp2p-relay-daemon)

  'go-rv1-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(1)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory)
      ])
    }
  },

  'js-rv1-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(1)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory)
      ])
    }
  },

  'js-rv1-go': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(1)
      return Promise.all([
        createJs([randomWsAddr], factory),
        relay,
        createGo([randomWsAddr], factory)
      ])
    }
  },

  'go-rv1-js': {
    /**
     * @param {Factory} factory
     */
    create: async (factory) => {
      const relay = await getRelayV(1)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory)
      ])
    }
  }
}
