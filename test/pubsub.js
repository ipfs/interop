/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const pRetry = require('p-retry')
const { expect } = require('./utils/chai')
const daemonFactory = require('./utils/daemon-factory')
const delay = require('delay')

const waitForTopicPeer = (topic, peer, daemon) => {
  const start = Date.now()

  return pRetry(async (attempt) => {
    const peers = await daemon.api.pubsub.peers(topic)

    if (!peers.includes(peer.id)) {
      throw new Error(`Could not find peer ${peer.id} after ${attempt} retries and ${Date.now() - start}ms`)
    }
  })
}

const daemonOptions = {
  args: ['--enable-pubsub-experiment']
}

const timeout = 60 * 1000

describe('pubsub', function () {
  this.timeout(timeout)

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
        [daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn()))
      })

      before('connect', async function () {
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

      function testPubsub (data) {
        const topic = 'pubsub-' + Math.random()

        const subscriber = () => new Promise((resolve, reject) => {
          daemon1.api.pubsub.subscribe(topic, () => {})
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            try {
              expect(msg.data).to.deep.equal(data)
              expect(msg).to.have.property('seqno')
              expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
              expect(msg).to.have.property('topicIDs').and.to.include(topic)
              expect(msg).to.have.property('from', daemon1.api.peerId.id)

              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, daemon1.api.peerId, daemon2)
          await waitForTopicPeer(topic, daemon2.api.peerId, daemon1)
          await delay(20000) // FIXME: https://github.com/libp2p/go-libp2p-pubsub/issues/331
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      }

      it('should exchange ascii data', function () {
        return testPubsub(Buffer.from('hello world'))
      })

      it('should exchange non ascii data', function () {
        return testPubsub(Buffer.from('你好世界'))
      })

      it('should exchange binary data', function () {
        return testPubsub(Buffer.from('a36161636179656162830103056164a16466666666f400010203040506070809', 'hex'))
      })
    })
  })
})
