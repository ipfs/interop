/* eslint-env mocha */

import PeerID from 'peer-id'
import { peerIdToRoutingKey } from 'ipns'
import last from 'it-last'
import pRetry from 'p-retry'
import { waitFor } from './utils/wait-for.js'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

const daemonsOptions = {
  args: ['--enable-namesys-pubsub'] // enable ipns over pubsub
}

const retryOptions = {
  retries: 5
}

const namespace = '/record/'

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', function () {
  /** @type {Controller[]} */
  let nodes = []
  /** @type {Factory} */
  let factory

  before(async () => {
    factory = await daemonFactory()
  })

  // Spawn daemons
  before('create the nodes', async function () {
    this.timeout(20e3)
    nodes = await Promise.all([
      factory.spawn({
        type: 'go',
        test: true,
        ...daemonsOptions
      }),
      factory.spawn({
        type: 'js',
        test: true,
        ...daemonsOptions
      }),
      // TODO: go-ipfs needs two nodes in the DHT to be able to publish a record
      // Remove this when js-ipfs has a DHT
      factory.spawn({
        type: 'go',
        test: true,
        ...daemonsOptions
      })
    ])
  })

  // Connect nodes and wait for republish
  before('connect the nodes', async function () {
    this.timeout(10e3)
    // TODO: go-ipfs needs two nodes in the DHT to be able to publish a record
    // Remove the second connect when js-ipfs runs a DHT server
    await Promise.all([
      nodes[0].api.swarm.connect(nodes[1].peer.addresses[0]),
      nodes[0].api.swarm.connect(nodes[2].peer.addresses[0])
    ])
  })

  after(() => factory.clean())

  it('should get enabled state of pubsub', async function () {
    for (const node of nodes) {
      const state = await node.api.name.pubsub.state()
      expect(state).to.exist()
      expect(state.enabled).to.equal(true)
    }
  })

  it('should publish the received record to a go node and a js subscriber should receive it', async function () {
    // TODO find out why JS doesn't resolve, might be just missing a DHT
    await Promise.all([
      subscribeToReceiveByPubsub(nodes[0], nodes[1], nodes[0].peer.id, nodes[1].peer.id),
      expect(last(nodes[1].api.name.resolve(nodes[0].peer.id))).to.eventually.be.rejected.with.property('message', /was not found in the network/)
    ])
  })

  it('should publish the received record to a js node and a go subscriber should receive it', async function () {
    await Promise.all([
      subscribeToReceiveByPubsub(nodes[1], nodes[0], nodes[1].peer.id, nodes[0].peer.id),
      last(nodes[0].api.name.resolve(nodes[1].peer.id))
    ])
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
/**
 * @param {Controller} nodeA
 * @param {Controller} nodeB
 * @param {*} idA
 * @param {*} idB
 */
const subscribeToReceiveByPubsub = async (nodeA, nodeB, idA, idB) => {
  let subscribed = false
  function checkMessage () {
    subscribed = true
  }

  const routingKey = peerIdToRoutingKey(idA)
  const topic = `${namespace}${uint8ArrayToString(routingKey, 'base64url')}`

  await waitForPeerToSubscribe(nodeB.api, topic)
  await nodeB.api.pubsub.subscribe(topic, checkMessage)
  await waitForNotificationOfSubscription(nodeA.api, topic, idB)
  const res1 = await nodeA.api.name.publish(ipfsRef, { resolve: false })
  await waitFor(() => subscribed === true, (50 * 1000))
  const res2 = await last(nodeB.api.name.resolve(idA))

  expect(PeerID.parse(res1.name).toString()).to.equal(PeerID.parse(idA).toString()) // Published to Node A ID
  expect(res2).to.equal(ipfsRef)
}

/**
 * Wait until a peer know about other peer to subscribe a topic
 *
 * @param {Controller["api"]} daemon
 * @param {string} topic
 * @param {Controller["peer"]["id"]} peerId
 */
const waitForNotificationOfSubscription = (daemon, topic, peerId) => pRetry(async () => {
  const res = await daemon.pubsub.peers(topic)

  if (!res || !res.length || !res.map(p => p.toString()).includes(peerId.toString())) {
    throw new Error('Could not find peer subscribing')
  }
}, retryOptions)

/**
 * Wait until a peer subscribes a topic
 *
 * @param {Controller["api"]} daemon
 * @param {string} topic
 */
const waitForPeerToSubscribe = async (daemon, topic) => {
  await pRetry(async () => {
    const res = await daemon.pubsub.ls()

    if (!res || !res.length || !res.includes(topic)) {
      throw new Error(`Could not find subscription to ${topic} in "${JSON.stringify(res)}"`)
    }

    return res[0]
  }, retryOptions)
}
