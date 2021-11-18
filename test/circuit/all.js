/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createJs, createGo, createGoRelay } from '../utils/circuit.js'

const base = '/ip4/127.0.0.1/tcp/0'

export default {
  'go-go-go': {
    create: async (factory) => {
      const goRelayV2 = await createGoRelay([`${base}/ws`], factory)
      return Promise.all([
        createGo([`${base}/ws`], factory),
        goRelayV2,
        createGo([`${base}/ws`], factory, goRelayV2)
      ])
    }
  },
  'js-go-go': {
    skip: () => true, // FIXME no circuit v2 support in js-ipfs
    create: async (factory) => {
      const goRelayV2 = await createGoRelay([`${base}/ws`], factory)
      return Promise.all([
        createJs([`${base}/ws`], factory),
        goRelayV2,
        createGo([`${base}/ws`], factory, goRelayV2)
      ])
    }
  },
  'go-go-js': {
    skip: () => true, // FIXME no circuit v2 support in js-ipfs
    create: async (factory) => {
      const goRelayV2 = await createGoRelay([`${base}/ws`], factory)
      return Promise.all([
        createGo([`${base}/ws`], factory, goRelayV2),
        goRelayV2,
        createJs([`${base}/ws`], factory)
      ])
    }
  },
  'js-go-js': {
    skip: () => true, // FIXME no circuit v2 support in js-ipfs
    create: async (factory) => {
      const goRelayV2 = await createGoRelay([`${base}/ws`], factory)
      return Promise.all([
        createJs([`${base}/ws`], factory),
        goRelayV2,
        createJs([`${base}/ws`], factory)
      ])
    }
  },
  'go-js-go': {
    create: async (factory) => {
      return Promise.all([
        createGo([`${base}/ws`], factory),
        createJs([`${base}/ws`], factory),
        createGo([`${base}/ws`], factory)
      ])
    }
  },
  'js-js-go': {
    create: async (factory) => {
      return Promise.all([
        createJs([`${base}/ws`], factory),
        createJs([`${base}/ws`], factory),
        createGo([`${base}/ws`], factory)
      ])
    }
  },
  'go-js-js': {
    create: (factory) => Promise.all([
      createGo([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory)
    ])
  },
  'js-js-js': {
    create: (factory) => Promise.all([
      createJs([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory)
    ])
  }
}
