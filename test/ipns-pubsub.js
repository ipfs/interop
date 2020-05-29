/* eslint-env mocha */
'use strict'

const { fromB58String } = require('multihashes')
const base64url = require('base64url')
const ipns = require('ipns')
const delay = require('delay')
const last = require('it-last')
const drain = require('it-drain')
const pRetry = require('p-retry')
const waitFor = require('./utils/wait-for')
const { expect } = require('./utils/chai')
const daemonFactory = require('./utils/daemon-factory')

const daemonsOptions = {
  args: ['--enable-namesys-pubsub'] // enable ipns over pubsub
}

const namespace = '/record/'

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', function () {
  this.timeout(350 * 1000)
  let go
  let js
  let otherGo

  // Spawn daemons
  before(async function () {
    [
      go,
      js,
      otherGo
    ] = await Promise.all([
      daemonFactory.spawn({
        type: 'go',
        test: true,
        ...daemonsOptions
      }),
      daemonFactory.spawn({
        type: 'js',
        test: true,
        ...daemonsOptions
      }),
      // TODO: go-ipfs needs two nodes in the DHT to be able to publish a record
      // Remove this when js-ipfs has a DHT
      daemonFactory.spawn({
        type: 'go',
        test: true,
        ...daemonsOptions
      })
    ])
  })

  // Connect nodes and wait for republish
  before(async function () {
    await go.api.swarm.connect(js.api.peerId.addresses[0])

    // TODO: go-ipfs needs two nodes in the DHT to be able to publish a record
    // Remove this when js-ipfs has a DHT
    await go.api.swarm.connect(otherGo.api.peerId.addresses[0])

    console.log('wait for republish as we can receive the republish message first') // eslint-disable-line
    await delay(60000)
  })

  after(() => daemonFactory.clean())

  it('should get enabled state of pubsub', async function () {
    for (const node of [js, go]) {
      const state = await node.api.name.pubsub.state()
      expect(state).to.exist()
      expect(state.enabled).to.equal(true)
    }
  })

  it('should publish the received record to a go node and a js subscriber should receive it', async function () {
    this.timeout(300 * 1000)
    // TODO find out why JS doesn't resolve, might be just missing a DHT
    await expect(last(js.api.name.resolve(go.api.peerId.id, { stream: false }))).to.eventually.be.rejected.with(/was not found in the network/)
    await subscribeToReceiveByPubsub(go, js, go.api.peerId.id, js.api.peerId.id)
  })

  it('should publish the received record to a js node and a go subscriber should receive it', async function () {
    this.timeout(350 * 1000)
    await drain(go.api.name.resolve(js.api.peerId.id, { stream: false }))
    await subscribeToReceiveByPubsub(js, go, js.api.peerId.id, go.api.peerId.id)
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
const subscribeToReceiveByPubsub = async (nodeA, nodeB, idA, idB) => {
  let subscribed = false
  function checkMessage (msg) {
    subscribed = true
  }

  const keys = ipns.getIdKeys(fromB58String(idA))
  const topic = `${namespace}${base64url.encode(keys.routingKey.toBuffer())}`

  await waitForPeerToSubscribe(nodeB.api, topic)
  await nodeB.api.pubsub.subscribe(topic, checkMessage)
  await waitForNotificationOfSubscription(nodeA.api, topic, idB)
  await delay(20000) // FIXME: gossipsub need this delay https://github.com/libp2p/go-libp2p-pubsub/issues/331
  const res1 = await nodeA.api.name.publish(ipfsRef, { resolve: false })
  await waitFor(() => subscribed === true, (50 * 1000))
  const res2 = await last(nodeB.api.name.resolve(idA))

  expect(res1.name).to.equal(idA) // Published to Node A ID
  expect(res2).to.equal(ipfsRef)
}

// wait until a peer know about other peer to subscribe a topic
const waitForNotificationOfSubscription = async (daemon, topic, peerId) => {
  const start = Date.now()

  await pRetry(async (attempt) => {
    const res = await daemon.pubsub.peers(topic)

    if (!res.includes(peerId)) {
      throw new Error(`Could not find peer ${peerId} subscription in list ${res} after ${attempt} retries and ${Date.now() - start}ms`)
    }
  })
}

// Wait until a peer subscribes a topic
const waitForPeerToSubscribe = async (daemon, topic) => {
  const start = Date.now()

  await pRetry(async (attempt) => {
    const res = await daemon.pubsub.ls()

    if (!res.includes(topic)) {
      throw new Error(`Could not find subscription to ${topic} in ${res} after ${attempt} retries and ${Date.now() - start}ms`)
    }

    return res[0]
  })
}
