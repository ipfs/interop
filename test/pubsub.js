/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */

import pRetry from 'p-retry'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'

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
  this.timeout(60 * 1000)

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
        this.timeout(timeout)
        ;[daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn(factory)))
      })

      before('connect', async function () {
        this.timeout(timeout)

        await daemon1.api.swarm.connect(daemon2.peer.addresses[0])
        await daemon2.api.swarm.connect(daemon1.peer.addresses[0])

        const peers = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peers[0].map((p) => p.peer.toString())).to.include(daemon2.peer.id)
        expect(peers[1].map((p) => p.peer.toString())).to.include(daemon1.peer.id)
      })

      after(() => factory.clean())

      it('should exchange ascii data', function () {
        const data = uint8ArrayFromString('hello world')
        const topic = 'pubsub-ascii'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.sequenceNumber).to.be.a('bigint')
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.peer.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange non ascii data', function () {
        const data = uint8ArrayFromString('你好世界 zażółć gęślą jaźń')
        const topic = 'pubsub-non-ascii'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.sequenceNumber).to.be.a('bigint')
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.peer.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange binary data', function () {
        const data = uint8ArrayFromString('a36161636179656162830103056164a16466666666f400010203040506070809', 'base16')
        const topic = 'pubsub-binary'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.sequenceNumber).to.be.a('bigint')
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.peer.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange data over a topic with unicode and newlines', function () {
        const data = uint8ArrayFromString('你好世界\nzażółć\r\ngęślą\njaźń')
        const topic = 'pubsub\n你好世界\r\njaźń'

        /** @type {() => Promise<void>} */
        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.sequenceNumber).to.be.a('bigint')
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.peer.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.peer, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })
    })
  })
})
