/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const parallel = require('async/parallel')
const retry = require('async/retry')

const {
  spawnInitAndStartGoDaemon,
  spawnInitAndStartJsDaemon
} = require('./utils/daemon')

const waitForTopicPeer = (topic, peer, daemon, callback) => {
  retry({
    times: 5,
    interval: 1000
  }, (next) => {
    daemon.api.pubsub.peers(topic, (error, peers) => {
      if (error) {
        return next(error)
      }

      if (!peers.includes(peer.id)) {
        return next(new Error(`Could not find peer ${peer.id}`))
      }

      return next()
    })
  }, callback)
}

const timeout = 20e3
function createJs () {
  return spawnInitAndStartJsDaemon()
}
function createGo () {
  return spawnInitAndStartGoDaemon({ args: ['--enable-pubsub-experiment'] })
}

describe('pubsub', function () {
  const tests = {
    'publish from Go, subscribe on Go': [createGo, createGo],
    'publish from JS, subscribe on JS': [createJs, createJs],
    'publish from JS, subscribe on Go': [createJs, createGo],
    'publish from Go, subscribe on JS': [createGo, createJs]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, function () {
      let daemon1
      let daemon2
      let id1
      let id2

      before('spawn nodes', function () {
        this.timeout(timeout)

        return Promise.all(tests[name].map(fn => fn()))
          .then(nodes => {
            [daemon1, daemon2] = nodes
          })
      })

      before('connect', function (done) {
        this.timeout(timeout)

        series([
          (cb) => parallel([
            (cb) => daemon1.api.id(cb),
            (cb) => daemon2.api.id(cb)
          ], (err, ids) => {
            expect(err).to.not.exist()
            id1 = ids[0]
            id2 = ids[1]
            cb()
          }),
          (cb) => daemon1.api.swarm.connect(id2.addresses[0], cb),
          (cb) => daemon2.api.swarm.connect(id1.addresses[0], cb),
          (cb) => parallel([
            (cb) => daemon1.api.swarm.peers(cb),
            (cb) => daemon2.api.swarm.peers(cb)
          ], (err, peers) => {
            expect(err).to.not.exist()
            expect(peers[0].map((p) => p.peer.toB58String())).to.include(id2.id)
            expect(peers[1].map((p) => p.peer.toB58String())).to.include(id1.id)
            cb()
          })
        ], done)
      })

      after('stop nodes', function (done) {
        this.timeout(timeout)

        parallel([daemon1, daemon2].map((node) => (cb) => node.stop(cb)), done)
      })

      it('should exchange ascii data', function (done) {
        const data = Buffer.from('hello world')
        const topic = 'pubsub-ascii'

        function checkMessage (msg) {
          expect(msg.data.toString()).to.equal(data.toString())
          expect(msg).to.have.property('seqno')
          expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
          expect(msg).to.have.property('topicIDs').eql([topic])
          expect(msg).to.have.property('from', id1.id)
          done()
        }

        series([
          (cb) => daemon2.api.pubsub.subscribe(topic, checkMessage, cb),
          (cb) => waitForTopicPeer(topic, id2, daemon1, cb),
          (cb) => daemon1.api.pubsub.publish(topic, data, cb)
        ], (err) => {
          if (err) return done(err)
        })
      })

      it('should exchange non ascii data', function (done) {
        const data = Buffer.from('你好世界')
        const topic = 'pubsub-non-ascii'

        function checkMessage (msg) {
          expect(msg.data.toString()).to.equal(data.toString())
          expect(msg).to.have.property('seqno')
          expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
          expect(msg).to.have.property('topicIDs').eql([topic])
          expect(msg).to.have.property('from', id1.id)
          done()
        }

        series([
          (cb) => daemon2.api.pubsub.subscribe(topic, checkMessage, cb),
          (cb) => waitForTopicPeer(topic, id2, daemon1, cb),
          (cb) => daemon1.api.pubsub.publish(topic, data, cb)
        ], (err) => {
          if (err) return done(err)
        })
      })

      it('should exchange binary data', function (done) {
        const data = Buffer.from('a36161636179656162830103056164a16466666666f400010203040506070809', 'hex')
        const topic = 'pubsub-binary'

        function checkMessage (msg) {
          expect(msg.data.toString()).to.equal(data.toString())
          expect(msg).to.have.property('seqno')
          expect(Buffer.isBuffer(msg.seqno)).to.be.eql(true)
          expect(msg).to.have.property('topicIDs').eql([topic])
          expect(msg).to.have.property('from', id1.id)
          done()
        }

        series([
          (cb) => daemon2.api.pubsub.subscribe(topic, checkMessage, cb),
          (cb) => waitForTopicPeer(topic, id2, daemon1, cb),
          (cb) => daemon1.api.pubsub.publish(topic, data, cb)
        ], (err) => {
          if (err) return done(err)
        })
      })
    })
  })
})
