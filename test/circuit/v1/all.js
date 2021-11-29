/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createJs, createGo, randomWsAddr } from '../../utils/circuit.js'
import { getRelayV } from '../../utils/relayd.js'

export default {

  // rv1 is a standalone, reference implementation of circuit relay v1
  // (https://github.com/libp2p/go-libp2p-relay-daemon)

  'go-rv1-go': {
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
    create: async (factory) => {
      const relay = await getRelayV(1)
      return Promise.all([
        createGo([randomWsAddr], factory),
        relay,
        createJs([randomWsAddr], factory)
      ])
    }
  },

  // Below are legacy tests that use js-ipfs as v1 relay
  // (no tests for go-ipfs as relay v1, because since 0.11 it only supports v2)
  // FIXME: remove after js-ipfs migrates to v2

  'go-js-go': {
    create: async (factory) => {
      return Promise.all([
        createGo([randomWsAddr], factory),
        createJs([randomWsAddr], factory),
        createGo([randomWsAddr], factory)
      ])
    }
  },
  'js-js-go': {
    create: async (factory) => {
      return Promise.all([
        createJs([randomWsAddr], factory),
        createJs([randomWsAddr], factory),
        createGo([randomWsAddr], factory)
      ])
    }
  },
  'go-js-js': {
    create: (factory) => Promise.all([
      createGo([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory)
    ])
  },
  'js-js-js': {
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory)
    ])
  }

}
