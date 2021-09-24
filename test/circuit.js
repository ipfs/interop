/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

import all from './circuit/all.js'
import browser from './circuit/browser.js'
import isNode from 'detect-node'
import { connect, send, clean } from './utils/circuit.js'
import { daemonFactory } from './utils/daemon-factory.js'

const timeout = 80 * 1000
const baseTest = {
  connect,
  send,
  timeout
}

describe('circuit', () => {
  let factory

  before(async () => {
    factory = await daemonFactory()
  })

  const tests = isNode ? all : browser

  Object.keys(tests).forEach((test) => {
    let nodeA
    let relay
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
