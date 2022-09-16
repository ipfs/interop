/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */

import pRetry from 'p-retry'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { isPeerId } from '@libp2p/interface-peer-id'
import pTimeout from 'p-timeout'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

const retryOptions = {
  retries: 5
}

/**
 * @param {string} topic
 * @param {Controller["peer"]} peer
 * @param {Controller} daemon
 */
const waitForTopicPeer = (topic, peer, daemon) => {
  return pRetry(async () => {
    const peers = await daemon.api.pubsub.peers(topic)

    if (!peers.map(p => p.toString()).includes(peer.id.toString())) {
      throw new Error(`Could not find peer ${peer.id}`)
    }
  }, retryOptions)
}

const daemonOptions = {
  args: ['--enable-pubsub-experiment']
}

const timeout = 20e3

describe('pubsub', function () {
  this.timeout(60e3)

  /** @type {Record<string, ((fac: Factory) => Promise<Controller>)[]>} */
  const tests = {
    'publish from Go, subscribe on Go': [(factory) => factory.spawn({ ...daemonOptions, type: 'go' }), (factory) => factory.spawn({ ...daemonOptions, type: 'go' })],
    'publish from JS, subscribe on JS': [(factory) => factory.spawn({ type: 'js' }), (factory) => factory.spawn({ type: 'js' })],
    'publish from JS, subscribe on Go': [(factory) => factory.spawn({ type: 'js' }), (factory) => factory.spawn({ ...daemonOptions, type: 'go' })],
    'publish from Go, subscribe on JS': [(factory) => factory.spawn({ ...daemonOptions, type: 'go' }), (factory) => factory.spawn({ type: 'js' })]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, function () {
      /** @type {Controller} */
      let daemon1
      /** @type {Controller} */
      let daemon2
      /** @type {Factory} */
      let factory

      before(async () => {
        factory = await daemonFactory()
      })

      after(() => factory.clean())

      before('spawn nodes', async function () {
        [daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn(factory)))
      })

      before('connect', async function () {
        await daemon1.api.swarm.connect(daemon2.peer.addresses[0])
        await daemon2.api.swarm.connect(daemon1.peer.addresses[0])

        const peers = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peers[0].map((p) => p.peer.toString())).to.include(daemon2.peer.id.toString())
        expect(peers[1].map((p) => p.peer.toString())).to.include(daemon1.peer.id.toString())
      })

      after(() => factory.clean())

      it('should exchange ascii data', function () {
        const data = uint8ArrayFromString('hello world')
        const topic = 'pubsub-ascii'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve, reject) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            try {
              if (msg.type !== 'signed') {
                throw new Error('Message was unsigned')
              }

              expect(uint8ArrayEquals(data, msg.data)).to.be.true()
              expect(msg).to.have.property('sequenceNumber')
              expect(msg.sequenceNumber).to.be.a('bigint')
              expect(msg).to.have.property('topic', topic)
              expect(isPeerId(msg.from)).to.be.true()
              expect(msg.from.toString()).to.equal(daemon1.peer.id.toString())
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          pTimeout(subscriber(), {
            milliseconds: timeout,
            message: 'subscriber timed out'
          }),
          pTimeout(publisher(), {
            milliseconds: timeout,
            message: 'publisher timed out'
          })
        ])
      })

      it('should exchange non ascii data', function () {
        const data = uint8ArrayFromString('你好世界 zażółć gęślą jaźń')
        const topic = 'pubsub-non-ascii'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve, reject) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            try {
              if (msg.type !== 'signed') {
                throw new Error('Message was unsigned')
              }

              expect(uint8ArrayEquals(data, msg.data)).to.be.true()
              expect(msg).to.have.property('sequenceNumber')
              expect(msg.sequenceNumber).to.be.a('bigint')
              expect(msg).to.have.property('topic', topic)
              expect(isPeerId(msg.from)).to.be.true()
              expect(msg.from.toString()).to.equal(daemon1.peer.id.toString())
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          pTimeout(subscriber(), {
            milliseconds: timeout,
            message: 'subscriber timed out'
          }),
          pTimeout(publisher(), {
            milliseconds: timeout,
            message: 'publisher timed out'
          })
        ])
      })

      it('should exchange binary data', function () {
        const data = uint8ArrayFromString('a36161636179656162830103056164a16466666666f400010203040506070809', 'base16')
        const topic = 'pubsub-binary'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve, reject) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            try {
              if (msg.type !== 'signed') {
                throw new Error('Message was unsigned')
              }

              expect(uint8ArrayEquals(data, msg.data)).to.be.true()
              expect(msg).to.have.property('sequenceNumber')
              expect(msg.sequenceNumber).to.be.a('bigint')
              expect(msg).to.have.property('topic', topic)
              expect(isPeerId(msg.from)).to.be.true()
              expect(msg.from.toString()).to.equal(daemon1.peer.id.toString())
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          pTimeout(subscriber(), {
            milliseconds: timeout,
            message: 'subscriber timed out'
          }),
          pTimeout(publisher(), {
            milliseconds: timeout,
            message: 'publisher timed out'
          })
        ])
      })

      it('should exchange data over a topic with unicode and newlines', function () {
        const data = uint8ArrayFromString('你好世界\nzażółć\r\ngęślą\njaźń')
        const topic = 'pubsub\n你好世界\r\njaźń'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve, reject) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            try {
              if (msg.type !== 'signed') {
                throw new Error('Message was unsigned')
              }

              expect(uint8ArrayEquals(data, msg.data)).to.be.true()
              expect(msg).to.have.property('sequenceNumber')
              expect(msg.sequenceNumber).to.be.a('bigint')
              expect(msg).to.have.property('topic', topic)
              expect(isPeerId(msg.from)).to.be.true()
              expect(msg.from.toString()).to.equal(daemon1.peer.id.toString())
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          pTimeout(subscriber(), {
            milliseconds: timeout,
            message: 'subscriber timed out'
          }),
          pTimeout(publisher(), {
            milliseconds: timeout,
            message: 'publisher timed out'
          })
        ])
      })
    })
  })
})
