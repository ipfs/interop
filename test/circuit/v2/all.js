/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createGo, createGoRelay, randomWsAddr } from '../../utils/circuit.js'
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
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },

  'js-rv2-go': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },

  'go-rv2-js': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
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
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },
  'go-go-js': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },
  'js-go-js': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },

  // relay v2 implementation in js-ipfs

  'go-js-go': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },
  'js-js-go': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },
  'go-js-js': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  },
  'js-js-js': {
    skip: () => true // FIXME when we have circuit v2 in js-ipfs
  }

}
