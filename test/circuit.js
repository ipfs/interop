/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)

const all = require('./circuit/all')
const browser = require('./circuit/browser')

const isNode = require('detect-node')
const send = require('./utils/circuit').send
const connect = require('./utils/circuit').connect

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
    let nodes
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
        const _nodes = await tests[test].create()
        nodes = _nodes.map((n) => n.ipfsd)
        nodeA = _nodes[0]
        relay = _nodes[1]
        nodeB = _nodes[2]
      })

      after(() => Promise.all(nodes.map((node) => node.stop())))

      it('connect', (done) => {
        tests[test].connect(nodeA, nodeB, relay, done)
      })

      it('send', (done) => {
        tests[test].send(nodeA.ipfsd.api, nodeB.ipfsd.api, done)
      })
    })
  })
})
