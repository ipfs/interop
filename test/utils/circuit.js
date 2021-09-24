import delay from 'delay'
import randomBytes from 'iso-random-stream/src/random.js'
import concat from 'it-concat'
import WS from 'libp2p-websockets'
import filters from 'libp2p-websockets/src/filters.js'
import { expect } from 'aegir/utils/chai.js'

const transportKey = WS.prototype[Symbol.toStringTag]

export function createProc (addrs, factory) {
  return factory.spawn({
    type: 'proc',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        relay: {
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
          }
        }
      }
    }
  })
}

export function createJs (addrs, factory) {
  return factory.spawn({
    type: 'js',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true
          }
        }
      }
    }
  })
}

export function createGo (addrs, factory) {
  return factory.spawn({
    type: 'go',
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: addrs
        },
        Swarm: {
          DisableRelay: false,
          EnableRelayHop: true
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

export function getWsAddr (addrs) {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => {
      return a.includes('/ws') && !a.includes('/p2p-websocket-star')
    })

  if (!result) {
    throw new Error('No ws address found in ' + addrs)
  }

  return result
}

export function getWsStarAddr (addrs) {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error('No wsstar address found in ' + addrs)
  }

  return result
}

export function getWrtcStarAddr (addrs) {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => a.includes('/p2p-webrtc-star'))

  if (!result) {
    throw new Error('No webrtcstar address found in ' + addrs)
  }

  return result
}

export function getTcpAddr (addrs) {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error('No TCP address found in ' + addrs)
  }

  return result
}

export async function connect (nodeA, nodeB, relay, timeout = 1000) {
  const relayWsAddr = getWsAddr(relay.api.peerId.addresses)
  await nodeA.api.swarm.connect(relayWsAddr)
  await nodeB.api.swarm.connect(relayWsAddr)
  // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
  await delay(timeout)
  const nodeBCircuitAddr = `${relayWsAddr}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
  await nodeA.api.swarm.connect(nodeBCircuitAddr)
}

export function connWithTimeout (timeout) {
  return (nodeA, nodeB, relay) => {
    connect(nodeA, nodeB, relay, timeout)
  }
}
