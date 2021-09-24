/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import { createJs, createGo } from '../utils/circuit.js'

const base = '/ip4/127.0.0.1/tcp/0'

export default {
  'go-go-go': {
    create: (factory) => Promise.all([
      createGo([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory)
    ])
  },
  'js-go-go': {
    create: (factory) => Promise.all([
      createJs([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory)
    ])
  },
  'go-go-js': {
    create: (factory) => Promise.all([
      createGo([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory)
    ])
  },
  'js-go-js': {
    create: (factory) => Promise.all([
      createJs([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory)
    ])
  },
  'go-js-go': {
    create: (factory) => Promise.all([
      createGo([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory)
    ])
  },
  'js-js-go': {
    create: (factory) => Promise.all([
      createJs([`${base}/ws`], factory),
      createJs([`${base}/ws`], factory),
      createGo([`${base}/ws`], factory)
    ])
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
