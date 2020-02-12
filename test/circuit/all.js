/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const { createJs, createGo } = require('../utils/circuit')

const base = '/ip4/127.0.0.1/tcp/0'

module.exports = {
  'go-go-go': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`])
    ])
  },
  'js-go-go': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`])
    ])
  },
  'go-go-js': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`])
    ])
  },
  'js-go-js': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`])
    ])
  },
  'go-js-go': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`])
    ])
  },
  'js-js-go': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createGo([`${base}/ws`])
    ])
  },
  'go-js-js': {
    create: () => Promise.all([
      createGo([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`])
    ])
  },
  'js-js-js': {
    create: () => Promise.all([
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`]),
      createJs([`${base}/ws`])
    ])
  }
}
