/* eslint no-console: ["error", { allow: ["log"] }] */
import delay from 'delay'
import randomBytes from 'iso-random-stream/src/random.js'
import concat from 'it-concat'
import { WebSockets } from '@libp2p/websockets'
import pRetry from 'p-retry'
import * as filters from '@libp2p/websockets/filters'
import { expect } from 'aegir/chai'
import { multiaddr } from '@multiformats/multiaddr'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 * @typedef {import('@libp2p/interface-transport').MultiaddrFilter} MultiaddrFilter
 */

export const randomWsAddr = '/ip4/127.0.0.1/tcp/0/ws'

/**
 * @param {string[]} addrs
 * @param {Factory} factory
 * @param {Controller} [relay]
 */
export function createProc (addrs, factory, relay) {
  if (relay) {
    throw new Error('createProc missing support for static relay v2')
  }
  return factory.spawn({
    type: 'proc',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Routing: {
          Type: 'none'
        },
        relay: { // FIXME: this is circuit v1, needs support of v2
          enabled: true,
          hop: {
            enabled: true
          }
        }
      },
      libp2p: {
        transports: [
          new WebSockets({
            filter: /** @type {MultiaddrFilter} */(/** @type {unknown} */(filters.all))
          })
        ]
      }
    }
  })
}

/**
 * @param {string[]} addrs
 * @param {Factory} factory
 * @param {Controller} [relay]
 */
export function createJs (addrs, factory, relay) {
  if (relay) {
    throw new Error('createJs missing support for static relay v2')
  }
  return factory.spawn({
    type: 'js',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Routing: {
          Type: 'none'
        },
        relay: { // FIXME: this is circuit v1, needs support of v2
          enabled: true,
          hop: {
            enabled: true
          }
        }
      }
    }
  })
}

/**
 * creates "private" go-ipfs node which is uses static relay if specified
 *
 * @param {string[]} addrs
 * @param {Factory} factory
 * @param {Controller} [relay]
 */
export async function createGo (addrs, factory, relay) {
  let StaticRelays
  if (relay) {
    StaticRelays = [await getWsAddr(relay.api)]
  }
  return factory.spawn({
    type: 'go',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Swarm: {
          EnableHolePunching: false,
          // go uses circuit v2
          RelayClient: {
            Enabled: true,
            StaticRelays
          },
          RelayService: {
            Enabled: false
          }
        },
        Bootstraps: [],
        Discovery: {
          MDNS: {
            Enabled: false
          }
        },
        Routing: {
          Type: 'none'
        },
        Internal: {
          Libp2pForceReachability: 'private'
        }
      }
    }
  })
}

/**
 * creates "publicly diallable" go-ipfs running a relay service
 *
 * @param {string[]} addrs
 * @param {Factory} factory
 */
export function createGoRelay (addrs, factory) {
  return factory.spawn({
    type: 'go',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Swarm: {
          EnableHolePunching: false,
          // go uses circuit v2
          RelayClient: {
            Enabled: false
          },
          RelayService: {
            Enabled: true
          }
        },
        Bootstraps: [],
        Discovery: {
          MDNS: {
            Enabled: false
          }
        },
        Routing: {
          Type: 'none'
        },
        Internal: {
          Libp2pForceReachability: 'public'
        }
      }
    }
  })
}

/**
 * @param {Factory} factory
 */
export function clean (factory) {
  return factory.clean()
}

const data = randomBytes(128)

/**
 * @param {Controller} nodeA
 * @param {Controller} nodeB
 */
export async function send (nodeA, nodeB) {
  const { cid } = await nodeA.api.add(data)
  const buffer = await concat(nodeB.api.cat(cid))

  expect(buffer.slice()).to.deep.equal(data)
}

/**
 * @param {Controller["api"]} api
 */
export async function getWsAddr (api) {
  return await pRetry(async () => {
    const id = await api.id()

    const result = id.addresses
      .map((a) => a.toString())
      .find((a) => {
        return a.includes('/ws') && !a.includes('/p2p-websocket-star')
      })

    if (!result) {
      throw new Error(`No ws address found in ${id.addresses}`)
    }

    return multiaddr(result)
  })
}

/**
 * @param {Controller["api"]} api
 */
export async function getWsStarAddr (api) {
  return await pRetry(async () => {
    const id = await api.id()

    const result = id.addresses
      .map((a) => a.toString())
      .find((a) => a.includes('/p2p-websocket-star'))

    if (!result) {
      throw new Error(`No wsstar address found in ${id.addresses}`)
    }

    return multiaddr(result)
  })
}

/**
 * @param {Controller["api"]} api
 */
export async function getWrtcStarAddr (api) {
  return await pRetry(async () => {
    const id = await api.id()

    const result = id.addresses
      .map((a) => a.toString())
      .find((a) => a.includes('/p2p-webrtc-star'))

    if (!result) {
      throw new Error(`No webrtcstar address found in ${id.addresses}`)
    }

    return multiaddr(result)
  })
}

/**
 * @param {Controller["api"]} api
 */
export async function getTcpAddr (api) {
  return await pRetry(async () => {
    const id = await api.id()

    const result = id.addresses
      .map((a) => a.toString())
      .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

    if (!result) {
      throw new Error(`No TCP address found in ${id.addresses}`)
    }

    return multiaddr(result)
  })
}

/**
 * @param {Controller} nodeA
 * @param {Controller} nodeB
 * @param {Controller} relay
 * @param {number} timeout
 */
export async function connect (nodeA, nodeB, relay, timeout = 1000) {
  const relayWsAddr = await getWsAddr(relay.api)
  const nodeAId = (await nodeA.api.id()).id
  const nodeBId = (await nodeB.api.id()).id

  if (process.env.DEBUG) console.log(`connect A (${nodeAId.toString()}) to relay at`, relayWsAddr.toString())
  await nodeA.api.swarm.connect(relayWsAddr)

  if (process.env.DEBUG) console.log(`connect B (${nodeBId.toString()}) to relay at`, relayWsAddr.toString())
  await nodeB.api.swarm.connect(relayWsAddr)

  // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
  await delay(timeout)
  const nodeBCircuitAddr = multiaddr(`${relayWsAddr}/p2p-circuit/p2p/${nodeBId.toString()}`)
  if (process.env.DEBUG) console.log('connect A to B over circuit', nodeBCircuitAddr.toString())
  await nodeA.api.swarm.connect(nodeBCircuitAddr)

  if (process.env.DEBUG) {
    console.log('done!')

    /**
     * @param {string} name
     * @param {Controller} node
     */
    const listConnections = async (name, node) => {
      const peers = await node.api.swarm.peers()
      console.log(`${name} has connections`, peers.map(p => p.addr.toString()))
    }
    await listConnections('nodeA', nodeA)
    await listConnections('nodeB', nodeB)
  }
}

/**
 * @param {number} timeout
 * @returns
 */
export function connWithTimeout (timeout) {
  /**
   * @param {Controller} nodeA
   * @param {Controller} nodeB
   * @param {Controller} relay
   */
  const connectControllers = (nodeA, nodeB, relay) => {
    return connect(nodeA, nodeB, relay, timeout)
  }

  return connectControllers
}
