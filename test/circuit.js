/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import allV1 from './circuit/v1/all.js'
import allV2 from './circuit/v2/all.js'
import browserV1 from './circuit/v1/browser.js'
import browserV2 from './circuit/v2/browser.js'
import { isNode } from 'wherearewe'
import { connect, send, clean } from './utils/circuit.js'
import { closeRelays } from './utils/relayd.js'
import { daemonFactory } from './utils/daemon-factory.js'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

const timeout = 80 * 1000
const baseTest = {
  connect,
  send,
  timeout
}

describe('circuit', () => {
  after(closeRelays)

  // Legacy v1 (unlimited relay)
  describe('v1', () => {
    /** @type {Factory} */
    let factory

    before(async () => {
      factory = await daemonFactory()
    })

    /** @type {*} */
    const tests = isNode ? allV1 : browserV1

    Object.keys(tests).forEach((test) => {
      /** @type {Controller} */
      let nodeA
      /** @type {Controller} */
      let relay
      /** @type {Controller} */
      let nodeB

      tests[test] = Object.assign({}, baseTest, tests[test])

      const dsc = tests[test].skip && tests[test].skip()
        ? describe.skip
        : describe

      dsc(test, function () {
        this.timeout(tests[test].timeout)

        before(async () => {
          [nodeA, relay, nodeB] = await tests[test].create(factory)
        })

        after(() => clean(factory))

        it('connect', () => {
          return tests[test].connect(nodeA, nodeB, relay)
        })

        it('send', () => {
          return tests[test].send(nodeA, nodeB)
        })
      })
    })
  })

  // Modern v2 (limited relay)
  // https://github.com/libp2p/specs/blob/master/relay/circuit-v2.md
  describe('v2', () => {
    /** @type {Factory} */
    let factory

    before(async () => {
      factory = await daemonFactory()
    })

    /** @type {*} */
    const tests = isNode ? allV2 : browserV2

    Object.keys(tests).forEach((test) => {
      /** @type {Controller} */
      let nodeA
      /** @type {Controller} */
      let relay
      /** @type {Controller} */
      let nodeB

      tests[test] = Object.assign({}, baseTest, tests[test])

      const dsc = tests[test].skip && tests[test].skip()
        ? describe.skip
        : describe

      dsc(test, function () {
        this.timeout(tests[test].timeout)

        before(async () => {
          [nodeA, relay, nodeB] = await tests[test].create(factory)
        })

        after(() => clean(factory))

        it('connect', () => {
          return tests[test].connect(nodeA, nodeB, relay)
        })
        // Note: v2 provides a limited relay for things like hole punching – no send test
      })
    })
  })
})
