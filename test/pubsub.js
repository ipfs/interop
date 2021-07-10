/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const pRetry = require('p-retry')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')
const uint8ArrayFromString = require('uint8arrays/from-string')
const uint8ArrayEquals = require('uint8arrays/equals')

const retryOptions = {
  retries: 5
}

const waitForTopicPeer = (topic, peer, daemon) => {
  return pRetry(async () => {
    const peers = await daemon.api.pubsub.peers(topic)

    if (!peers.includes(peer.id)) {
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

  const tests = {
    'publish from Go, subscribe on Go': [() => daemonFactory.spawn({ ...daemonOptions, type: 'go' }), () => daemonFactory.spawn({ ...daemonOptions, type: 'go' })],
    'publish from JS, subscribe on JS': [() => daemonFactory.spawn({ type: 'js' }), () => daemonFactory.spawn({ type: 'js' })],
    'publish from JS, subscribe on Go': [() => daemonFactory.spawn({ type: 'js' }), () => daemonFactory.spawn({ ...daemonOptions, type: 'go' })],
    'publish from Go, subscribe on JS': [() => daemonFactory.spawn({ ...daemonOptions, type: 'go' }), () => daemonFactory.spawn({ type: 'js' })]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, function () {
      let daemon1
      let daemon2

      before('spawn nodes', async function () {
        this.timeout(timeout)
        ;[daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn()))
      })

      before('connect', async function () {
        this.timeout(timeout)

        await daemon1.api.swarm.connect(daemon2.api.peerId.addresses[0])
        await daemon2.api.swarm.connect(daemon1.api.peerId.addresses[0])

        const peers = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peers[0].map((p) => p.peer.toString())).to.include(daemon2.api.peerId.id)
        expect(peers[1].map((p) => p.peer.toString())).to.include(daemon1.api.peerId.id)
      })

      after(() => daemonFactory.clean())

      it('should exchange ascii data', function () {
        const data = uint8ArrayFromString('hello world')
        const topic = 'pubsub-ascii'

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.seqno).to.be.an.instanceof(Uint8Array)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.api.peerId.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.api.peerId, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange non ascii data', function () {
        const data = uint8ArrayFromString('你好世界')
        const topic = 'pubsub-non-ascii'

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.seqno).to.be.an.instanceof(Uint8Array)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.api.peerId.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.api.peerId, daemon1)
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

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(uint8ArrayEquals(data, msg.data)).to.be.true()
            expect(msg).to.have.property('seqno')
            expect(msg.seqno).to.be.an.instanceof(Uint8Array)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', daemon1.api.peerId.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon2.api.peerId, daemon1)
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
