/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const all = require('./circuit/all')
const browser = require('./circuit/browser')

const isNode = require('detect-node')
const { connect, send, clean } = require('./utils/circuit')

const timeout = 80 * 1000
const baseTest = {
  connect,
  send,
  timeout
}

describe('circuit', () => {
  const tests = all

  if (!isNode) {
    Object.assign(tests, browser)
  }

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
        [nodeA, relay, nodeB] = await tests[test].create()
      })

      after(clean)

      it('connect', () => {
        return tests[test].connect(nodeA, nodeB, relay)
      })

      it('send', () => {
        return tests[test].send(nodeA, nodeB)
      })
    })
  })
})
