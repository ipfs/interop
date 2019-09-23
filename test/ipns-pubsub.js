/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const { fromB58String } = require('multihashes')
const base64url = require('base64url')
const ipns = require('ipns')

const retry = require('async/retry')
const series = require('async/series')

const { spawnInitAndStartGoDaemon, spawnInitAndStartJsDaemon } = require('./utils/daemon')

const waitFor = require('./utils/wait-for')

const daemonsOptions = {
  args: ['--enable-namesys-pubsub'] // enable ipns over pubsub
}

const namespace = '/record/'

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', () => {
  let nodes = []
  let nodesIds = []

  // Spawn daemons
  before(async function () {
    // CI takes longer to instantiate the daemon, so we need to increase the timeout
    this.timeout(80 * 1000)

    nodes = await Promise.all([
      spawnInitAndStartGoDaemon(daemonsOptions),
      spawnInitAndStartJsDaemon(daemonsOptions)
    ])
  })

  // Get node ids
  before(async function () {
    this.timeout(100 * 1000)

    nodesIds = await Promise.all([
      nodes[0].api.id(),
      nodes[1].api.id()
    ])

    expect(nodesIds[0]).to.exist()
    expect(nodesIds[1]).to.exist()
    expect(nodesIds[0].id).to.exist()
    expect(nodesIds[1].id).to.exist()

    await nodes[0].api.swarm.connect(nodesIds[1].addresses[0])

    console.log('wait for republish as we can receive the republish message first') // eslint-disable-line
    return new Promise((resolve) => setTimeout(resolve, 60000))
  })

  after(function () {
    this.timeout(60 * 1000)

    return Promise.all(nodes.map((node) => node.stop()))
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

    subscribeToReceiveByPubsub(nodes[0], nodes[1], nodesIds[0].id, nodesIds[1].id, done)
  })

  it('should publish the received record to a js node and a go subscriber should receive it', function (done) {
    this.timeout(350 * 1000)

    subscribeToReceiveByPubsub(nodes[1], nodes[0], nodesIds[1].id, nodesIds[0].id, done)
  })
})

//  * IPNS resolve subscription test
//  * 1) name.resolve() , which subscribes the topic
//  * 2) wait to guarantee the subscription
//  * 3) subscribe again just to know until when to wait (inside the scope of the test)
//  * 4) wait for the other peer to get notified of the subscription
//  * 5) publish new ipns record
//  * 6) wait until the record is received in the test scope subscribe
//  * 7) resolve ipns record
const subscribeToReceiveByPubsub = (nodeA, nodeB, idA, idB, callback) => {
  let subscribed = false
  function checkMessage (msg) {
    subscribed = true
  }

  const keys = ipns.getIdKeys(fromB58String(idA))
  const topic = `${namespace}${base64url.encode(keys.routingKey.toBuffer())}`

  // try to resolve a unpublished record (will subscribe it)
  nodeB.api.name.resolve(idA, (err) => {
    expect(err).to.exist() // not found

    series([
      (cb) => waitForPeerToSubscribe(nodeB.api, topic, cb),
      (cb) => nodeB.api.pubsub.subscribe(topic, checkMessage, cb),
      (cb) => waitForNotificationOfSubscription(nodeA.api, topic, idB, cb),
      (cb) => nodeA.api.name.publish(ipfsRef, { resolve: false }, cb),
      (cb) => waitFor(() => subscribed === true, (50 * 1000), cb),
      (cb) => nodeB.api.name.resolve(idA, cb)
    ], (err, res) => {
      expect(err).to.not.exist()
      expect(res).to.exist()

      expect(res[3].name).to.equal(idA) // Published to Node A ID
      expect(res[5]).to.equal(ipfsRef)

      callback()
    })
  })
}

// wait until a peer know about other peer to subscribe a topic
const waitForNotificationOfSubscription = (daemon, topic, peerId, callback) => {
  retry({
    times: 5,
    interval: 2000
  }, (next) => {
    daemon.pubsub.peers(topic, (error, res) => {
      if (error) {
        return next(error)
      }

      if (!res || !res.length || !res.includes(peerId)) {
        return next(new Error('Could not find peer subscribing'))
      }

      return next(null)
    })
  }, callback)
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
