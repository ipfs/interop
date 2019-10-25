/* eslint-env mocha */
'use strict'

const chai = require('chai')
const expect = chai.expect

// Do not reorder these statements - https://github.com/chaijs/chai/issues/1298
chai.use(require('chai-as-promised'))
chai.use(require('dirty-chai'))

const { fromB58String } = require('multihashes')
const base64url = require('base64url')
const ipns = require('ipns')

const delay = require('delay')
const pRetry = require('./utils/p-retry')

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

const waitFor = require('./utils/wait-for')

const daemonsOptions = {
  args: ['--enable-namesys-pubsub'] // enable ipns over pubsub
}

const retryOptions = {
  retries: 5,
  interval: 2000
}

const namespace = '/record/'

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', function () {
  this.timeout(350 * 1000)
  let nodes = []
  let nodesIds = []

  // Spawn daemons
  before(async function () {
    nodes = await Promise.all([
      spawnGoDaemon(daemonsOptions),
      spawnJsDaemon(daemonsOptions)
    ])
  })

  // Get node ids
  before(async function () {
    nodesIds = await Promise.all([
      nodes[0].api.id(),
      nodes[1].api.id()
    ])

    expect(nodesIds).to.have.nested.property('[0].id').that.is.ok()
    expect(nodesIds).to.have.nested.property('[1].id').that.is.ok()

    await nodes[0].api.swarm.connect(nodesIds[1].addresses[0])

    console.log('wait for republish as we can receive the republish message first') // eslint-disable-line
    await delay(60000)
  })

  after(function () {
    return Promise.all(nodes.map((node) => node.stop()))
  })

  it('should get enabled state of pubsub', async function () {
    const state = await nodes[0].api.name.pubsub.state()

    expect(state).to.exist()
    expect(state.enabled).to.equal(true)
  })

  it('should publish the received record to a go node and a js subscriber should receive it', async function () {
    this.timeout(300 * 1000)

    await subscribeToReceiveByPubsub(nodes[0], nodes[1], nodesIds[0].id, nodesIds[1].id)
  })

  it('should publish the received record to a js node and a go subscriber should receive it', async function () {
    this.timeout(350 * 1000)

    await subscribeToReceiveByPubsub(nodes[1], nodes[0], nodesIds[1].id, nodesIds[0].id)
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

  // try to resolve a unpublished record (will subscribe it)
  await expect(nodeB.api.name.resolve(idA)).to.be.rejected()

  await waitForPeerToSubscribe(nodeB.api, topic)
  await nodeB.api.pubsub.subscribe(topic, checkMessage)
  await waitForNotificationOfSubscription(nodeA.api, topic, idB)
  const res1 = await nodeA.api.name.publish(ipfsRef, { resolve: false })
  await waitFor(() => subscribed === true, (50 * 1000))
  const res2 = await nodeB.api.name.resolve(idA)

  expect(res1.name).to.equal(idA) // Published to Node A ID
  expect(res2).to.equal(ipfsRef)
}

// wait until a peer know about other peer to subscribe a topic
const waitForNotificationOfSubscription = (daemon, topic, peerId) => pRetry(async () => {
  const res = await daemon.pubsub.peers(topic)

  if (!res || !res.length || !res.includes(peerId)) {
    throw new Error('Could not find peer subscribing')
  }
}, retryOptions)

// Wait until a peer subscribes a topic
const waitForPeerToSubscribe = async (daemon, topic) => {
  await pRetry(async () => {
    const res = await daemon.pubsub.ls()

    if (!res || !res.length || !res.includes(topic)) {
      throw new Error('Could not find subscription')
    }

    return res[0]
  }, retryOptions)
}
