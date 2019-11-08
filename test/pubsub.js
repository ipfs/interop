/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const pRetry = require('./utils/p-retry')
const { expect } = require('./utils/chai')

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

const retryOptions = {
  retries: 5,
  interval: 1000
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
    'publish from Go, subscribe on Go': [() => spawnGoDaemon(daemonOptions), () => spawnGoDaemon(daemonOptions)],
    'publish from JS, subscribe on JS': [() => spawnJsDaemon(), () => spawnJsDaemon()],
    'publish from JS, subscribe on Go': [() => spawnJsDaemon(), () => spawnGoDaemon(daemonOptions)],
    'publish from Go, subscribe on JS': [() => spawnGoDaemon(daemonOptions), () => spawnJsDaemon()]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, function () {
      let daemon1
      let daemon2
      let id1
      let id2

      before('spawn nodes', async function () {
        this.timeout(timeout); // eslint-disable-line

        [daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn()))
      })

      before('connect', async function () {
        this.timeout(timeout); // eslint-disable-line

        [id1, id2] = await Promise.all([
          daemon1.api.id(),
          daemon2.api.id()
        ])

        await daemon1.api.swarm.connect(id2.addresses[0])
        await daemon2.api.swarm.connect(id1.addresses[0])

        const peers = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peers[0].map((p) => p.peer.toB58String())).to.include(id2.id)
        expect(peers[1].map((p) => p.peer.toB58String())).to.include(id1.id)
      })

      after('stop nodes', function () {
        return Promise.all([daemon1, daemon2].map((node) => node.stop()))
      })

      it('should exchange ascii data', function () {
        const data = Buffer.from('hello world')
        const topic = 'pubsub-ascii'

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(msg.data.toString()).to.equal(data.toString())
            expect(msg).to.have.property('seqno')
            expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', id1.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, id2, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange non ascii data', function () {
        const data = Buffer.from('你好世界')
        const topic = 'pubsub-non-ascii'

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(msg.data.toString()).to.equal(data.toString())
            expect(msg).to.have.property('seqno')
            expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', id1.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, id2, daemon1)
          await daemon1.api.pubsub.publish(topic, data)
        }

        return Promise.all([
          subscriber(),
          publisher()
        ])
      })

      it('should exchange binary data', function () {
        const data = Buffer.from('a36161636179656162830103056164a16466666666f400010203040506070809', 'hex')
        const topic = 'pubsub-binary'

        const subscriber = () => new Promise((resolve) => {
          daemon2.api.pubsub.subscribe(topic, (msg) => {
            expect(msg.data.toString()).to.equal(data.toString())
            expect(msg).to.have.property('seqno')
            expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
            expect(msg).to.have.property('topicIDs').and.to.include(topic)
            expect(msg).to.have.property('from', id1.id)
            resolve()
          })
        })

        const publisher = async () => {
          await waitForTopicPeer(topic, id2, daemon1)
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
