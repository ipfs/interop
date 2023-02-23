/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createJs, randomWsAddr } from '../../utils/circuit.js'
import { getRelayV } from '../../utils/relayd.js'

/**
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

export default {

  // rv1 is a standalone, reference implementation of circuit relay v1
  // (https://github.com/libp2p/go-libp2p-relay-daemon)

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

  // Below are legacy tests that use js-ipfs as v1 relay
  // (no tests for go-ipfs as relay v1, because since 0.11 it only supports v2)
  // FIXME: remove after js-ipfs migrates to v2

  'js-js-js': {
    /**
     * @param {Factory} factory
     */
    create: (factory) => Promise.all([
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory),
      createJs([randomWsAddr], factory)
    ])
  }

}
