/* eslint-env mocha */

import { peerIdToRoutingKey } from 'ipns'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import last from 'it-last'
import { peerIdFromString } from '@libp2p/peer-id'
import defer from 'p-defer'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

const daemonsOptions = {
  args: ['--enable-namesys-pubsub'] // enable ipns over pubsub
}

const namespace = '/record/'

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe('ipns-pubsub', function () {
  /** @type {Controller} */
  let goNode0

  /** @type {Controller} */
  let goNode1

  /** @type {Controller} */
  let jsNode0

  /** @type {Controller} */
  let jsNode1

  /** @type {Factory} */
  let factory

  beforeEach(async () => {
    factory = await daemonFactory()
  })

  // Spawn daemons
  beforeEach('create the nodes', async function () {
    this.timeout(120e3)

    goNode0 = await factory.spawn({
      type: 'go',
      test: true,
      ...daemonsOptions
    })
    goNode1 = await factory.spawn({
      type: 'go',
      test: true,
      ...daemonsOptions
    })

    jsNode0 = await factory.spawn({
      type: 'js',
      test: true,
      ...daemonsOptions
    })
    jsNode1 = await factory.spawn({
      type: 'js',
      test: true,
      ...daemonsOptions
    })
  })

  // Connect nodes and wait for republish
  beforeEach('connect the nodes', async function () {
    this.timeout(60e3)
    // @ts-ignore
    await goNode0.api.swarm.connect(goNode1.peer.addresses[0])
    // @ts-ignore
    await goNode0.api.swarm.connect(jsNode0.peer.addresses[0])
    // @ts-ignore
    await goNode0.api.swarm.connect(jsNode1.peer.addresses[0])

    // @ts-ignore
    await jsNode0.api.swarm.connect(jsNode1.peer.addresses[0])
    // @ts-ignore
    await jsNode0.api.swarm.connect(goNode1.peer.addresses[0])
  })

  afterEach(() => factory.clean())

  it('should get enabled state of pubsub', async function () {
    for (const node of [goNode0, goNode1, jsNode0, jsNode1]) {
      await expect(node.api.name.pubsub.state()).to.eventually.have.property('enabled', true)
    }
  })

  it('should publish the received record to a go node and a js subscriber should receive it', async function () {
    await resolveByPubSub(goNode0, jsNode0)
  })

  it('should publish the received record to a js node and a go subscriber should receive it', async function () {
    await resolveByPubSub(goNode0, jsNode0)
  })

  it('should publish the received record to a go node and a go subscriber should receive it', async function () {
    await resolveByPubSub(goNode0, goNode1)
  })

  it('should publish the received record to a js node and a js subscriber should receive it', async function () {
    await resolveByPubSub(jsNode0, jsNode1)
  })
})

//  * IPNS resolve subscription test
//  * 1) name.resolve(), which subscribes the topic
//  * 2) check we are subscribed via name.subs
//  * 3) subscribe to the actual pubsub topic
//  * 4) publish new ipns record
//  * 6) ensure we have received an update via pubsub
//  * 7) resolve ipns record
/**
 * @param {Controller} publisher
 * @param {Controller} subscriber
 */
const resolveByPubSub = async (publisher, subscriber) => {
  const routingKey = peerIdToRoutingKey(publisher.peer.id)
  const topic = `${namespace}${uint8ArrayToString(routingKey, 'base64url')}`

  // should not be subscribed to anything
  await expect(subscriber.api.name.pubsub.subs()).to.eventually.have.lengthOf(0)

  try {
    // attempt to resolve the peer id - n.b js throws here, go does not because streaming API errors don't work over http
    await last(subscriber.api.name.resolve(publisher.peer.id, {
      timeout: 1000
    }))
  } catch {}

  // should now be subscribed to updates for the publisher's peer id
  const subs = await subscriber.api.name.pubsub.subs()
  expect(subs).to.have.lengthOf(1)
  const subbed = peerIdFromString(subs[0].split('/ipns/').pop() || '')
  expect(subbed.equals(publisher.peer.id)).to.be.true()

  // set up a listener for the pubsub topic for the IPNS key
  const deferred = defer()
  await subscriber.api.pubsub.subscribe(topic, () => {
    deferred.resolve()
  })

  // publish an update
  const res1 = await publisher.api.name.publish(ipfsRef, { resolve: false })

  // should receive a message on the topic for the IPNS key
  await deferred.promise

  // should succeed and be fast
  const res2 = await last(subscriber.api.name.resolve(publisher.peer.id, {
    timeout: 1000
  }))

  expect(peerIdFromString(res1.name).toString()).to.equal(publisher.peer.id.toString()) // Published to Node A ID
  expect(res2).to.equal(ipfsRef)
}
