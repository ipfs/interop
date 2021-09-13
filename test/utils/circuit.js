'use strict'

const delay = require('delay')
const randomBytes = require('iso-random-stream/src/random')
const concat = require('it-concat')
const WS = require('libp2p-websockets')
const filters = require('libp2p-websockets/src/filters')
const transportKey = WS.prototype[Symbol.toStringTag]

const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./daemon-factory')

exports.createProc = addrs => daemonFactory.spawn({
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

exports.createJs = addrs => daemonFactory.spawn({
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

exports.createGo = addrs => daemonFactory.spawn({
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

exports.clean = () => daemonFactory.clean()

const data = randomBytes(128)
exports.send = async (nodeA, nodeB) => {
  const { cid } = await nodeA.api.add(data)
  const buffer = await concat(nodeB.api.cat(cid))

  expect(buffer.slice()).to.deep.equal(data)
}

const getWsAddr = (addrs) => {
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

exports.getWsAddr = getWsAddr

const getWsStarAddr = (addrs) => {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error('No wsstar address found in ' + addrs)
  }

  return result
}

exports.getWsStarAddr = getWsStarAddr

const getWrtcStarAddr = (addrs) => {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => a.includes('/p2p-webrtc-star'))

  if (!result) {
    throw new Error('No webrtcstar address found in ' + addrs)
  }

  return result
}

exports.getWrtcStarAddr = getWrtcStarAddr

const getTcpAddr = (addrs) => {
  addrs = addrs.map((a) => a.toString())
  const result = addrs
    .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

  if (!result) {
    throw new Error('No TCP address found in ' + addrs)
  }

  return result
}

exports.getTcpAddr = getTcpAddr

const connect = async (nodeA, nodeB, relay, timeout = 1000) => {
  const relayWsAddr = getWsAddr(relay.api.peerId.addresses)
  await nodeA.api.swarm.connect(relayWsAddr)
  await nodeB.api.swarm.connect(relayWsAddr)
  // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
  await delay(timeout)
  const nodeBCircuitAddr = `${relayWsAddr}/p2p-circuit/p2p/${nodeB.api.peerId.id}`
  await nodeA.api.swarm.connect(nodeBCircuitAddr)
}

exports.connect = connect

exports.connWithTimeout = (timeout) => {
  return (nodeA, nodeB, relay) => {
    connect(nodeA, nodeB, relay, timeout)
  }
}
