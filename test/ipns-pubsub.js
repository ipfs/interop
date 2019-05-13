/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const { fromB58String } = require('multihashes')
const base64url = require('base64url')
const ipns = require('ipns')

const parallel = require('async/parallel')
const retry = require('async/retry')
const series = require('async/series')

const DaemonFactory = require('ipfsd-ctl')

const waitFor = require('./utils/wait-for')

const config = {
  Addresses: {
    API: '/ip4/0.0.0.0/tcp/0',
    Gateway: '/ip4/0.0.0.0/tcp/0',
    Swarm: []
  }
}

const namespace = '/record/'

const spawnJsDaemon = (callback) => {
  DaemonFactory.create({ type: 'js' })
    .spawn({
      disposable: true,
      args: ['--enable-namesys-pubsub'], // enable ipns over pubsub
      config
    }, callback)
}

const spawnGoDaemon = (callback) => {
  DaemonFactory.create()
    .spawn({
      disposable: true,
      args: ['--enable-namesys-pubsub'], // enable ipns over pubsub
      config
    }, callback)
}

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', () => {
  let nodeAId
  let nodeBId
  let nodes = []

  // Spawn daemons
  before(function (done) {
    // CI takes longer to instantiate the daemon, so we need to increase the timeout
    this.timeout(80 * 1000)

    series([
      (cb) => spawnGoDaemon(cb),
      (cb) => spawnJsDaemon(cb)
    ], (err, daemons) => {
      expect(err).to.not.exist()
      nodes = daemons

      done()
    })
  })

  // Get node ids
  before(function (done) {
    this.timeout(100 * 1000)

    parallel([
      (cb) => nodes[0].api.id(cb),
      (cb) => nodes[1].api.id(cb)
    ], (err, ids) => {
      expect(err).to.not.exist()
      expect(ids).to.exist()
      expect(ids[0].id).to.exist()
      expect(ids[1].id).to.exist()

      nodeAId = ids[0]
      nodeBId = ids[1]

      nodes[0].api.swarm.connect(ids[1].addresses[0], (err) => {
        expect(err).to.not.exist()

        console.log('wait for republish as we can receive the republish message first')
        setTimeout(done, 60000) // wait for republish as we can receive the republish message first
      })
    })
  })

  after(function (done) {
    this.timeout(60 * 1000)
    parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
  })

  it('should get enabled state of pubsub', function (done) {
    nodes[0].api.name.pubsub.state((err, state) => {
      expect(err).to.not.exist()
      expect(state).to.exist()
      expect(state.enabled).to.equal(true)

      done()
    })
  })

  it('should publish the received record to a go node and a js subscriber should receive it', function (done) {
    this.timeout(300 * 1000)

    subscribeToReceiveByPubsub(nodes[0], nodes[1], nodeAId.id, done)
  })

  it('should publish the received record to a js node and a go subscriber should receive it', function (done) {
    this.timeout(350 * 1000)

    subscribeToReceiveByPubsub(nodes[1], nodes[0], nodeBId.id, done)
  })
})

const subscribeToReceiveByPubsub = (nodeA, nodeB, id, callback) => {
  let subscribed = false
  function checkMessage (msg) {
    subscribed = true
  }

  const keys = ipns.getIdKeys(fromB58String(id))
  const topic = `${namespace}${base64url.encode(keys.routingKey.toBuffer())}`

  // try to resolve a unpublished record (will subscribe it)
  nodeB.api.name.resolve(id, (err) => {
    expect(err).to.exist() // not found

    series([
      (cb) => waitForPeerToSubscribe(nodeB.api, topic, cb),
      (cb) => nodeB.api.pubsub.subscribe(topic, checkMessage, cb),
      (cb) => nodeA.api.name.publish(ipfsRef, { resolve: false }, cb),
      (cb) => waitFor(() => subscribed === true, (50 * 1000), cb),
      (cb) => nodeB.api.name.resolve(id, cb)
    ], (err, res) => {
      expect(err).to.not.exist()
      expect(res).to.exist()

      expect(res[2].name).to.equal(id) // Published to Node A ID
      expect(res[4]).to.equal(ipfsRef)

      callback()
    })
  })
}

// Wait until a peer subscribes a topic
const waitForPeerToSubscribe = (daemon, topic, callback) => {
  retry({
    times: 5,
    interval: 2000
  }, (next) => {
    daemon.pubsub.ls((error, res) => {
      if (error) {
        return next(error)
      }

      if (!res || !res.length || !res.includes(topic)) {
        return next(new Error('Could not find subscription'))
      }

      return next(null, res[0])
    })
  }, callback)
}
