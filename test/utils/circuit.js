/* eslint no-console: ["error", { allow: ["log"] }] */
import delay from 'delay'
import randomBytes from 'iso-random-stream/src/random.js'
import concat from 'it-concat'
import WS from 'libp2p-websockets'
import filters from 'libp2p-websockets/src/filters.js'
import { expect } from 'aegir/utils/chai.js'

const transportKey = WS.prototype[Symbol.toStringTag]

export const randomWsAddr = '/ip4/127.0.0.1/tcp/0/ws'

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
        config: {
          transport: {
            [transportKey]: {
              filter: filters.all
            }
          },
          dht: {
            enabled: false
          }
        }
      }
    }
  })
}

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
        },
        libp2p: {
          config: {
            dht: {
              enabled: false
            }
          }
        }
      }
    }
  })
}

// creates "private" go-ipfs node which is uses static relay if specified
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

// creates "publicly diallable" go-ipfs running a relay service
export function createGoRelay (addrs, factory) {
  return factory.spawn({
    type: 'go',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Swarm: {
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

export function clean (factory) {
  return factory.clean()
}

const data = randomBytes(128)

export async function send (nodeA, nodeB) {
  const { cid } = await nodeA.api.add(data)
  const buffer = await concat(nodeB.api.cat(cid))

  expect(buffer.slice()).to.deep.equal(data)
}

export async function getWsAddr (api) {
  const id = await api.id()

  const result = id.addresses
    .map((a) => a.toString())
    .find((a) => {
      return a.includes('/ws') && !a.includes('/p2p-websocket-star')
    })

  if (!result) {
    throw new Error(`No ws address found in ${id.addresses}`)
  }

  return result
}

export async function getWsStarAddr (api) {
  const id = await api.id()

  const result = id.addresses
    .map((a) => a.toString())
    .find((a) => a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error(`No wsstar address found in ${id.addresses}`)
  }

  return result
}

export async function getWrtcStarAddr (api) {
  const id = await api.id()

  const result = id.addresses
    .map((a) => a.toString())
    .find((a) => a.includes('/p2p-webrtc-star'))

  if (!result) {
    throw new Error(`No webrtcstar address found in ${id.addresses}`)
  }

  return result
}

export async function getTcpAddr (api) {
  const id = await api.id()

  const result = id.addresses
    .map((a) => a.toString())
    .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error(`No TCP address found in ${id.addresses}`)
  }

  return result
}

export async function connect (nodeA, nodeB, relay, timeout = 1000) {
  const relayWsAddr = await getWsAddr(relay.api.peerId.addresses)
  const nodeAId = nodeA.api.peerId.id
  const nodeBId = nodeB.api.peerId.id

  if (process.env.DEBUG) console.log(`connect A (${nodeAId}) to relay at`, relayWsAddr)
  await nodeA.api.swarm.connect(relayWsAddr)

  if (process.env.DEBUG) console.log(`connect B (${nodeBId}) to relay at`, relayWsAddr)
  await nodeB.api.swarm.connect(relayWsAddr)

  // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
  await delay(timeout)
  const nodeBCircuitAddr = `${relayWsAddr}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
  if (process.env.DEBUG) console.log('connect A to B over circuit', nodeBCircuitAddr)
  await nodeA.api.swarm.connect(nodeBCircuitAddr)

  if (process.env.DEBUG) {
    console.log('done!')
    const listConnections = async (name, node) => {
      const peers = await node.api.swarm.peers()
      console.log(`${name} has connections`, peers.map(p => `${p.addr.toString()}/p2p/${p.peer}`))
    }
    await listConnections('nodeA', nodeA)
    await listConnections('nodeB', nodeB)
  }
}

export function connWithTimeout (timeout) {
  return (nodeA, nodeB, relay) => {
    return connect(nodeA, nodeB, relay, timeout)
  }
}
