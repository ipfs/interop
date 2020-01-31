'use strict'

const delay = require('delay')
const crypto = require('crypto')
const last = require('it-last')
const concat = require('it-concat')
const { expect } = require('./chai')
const { jsDaemonFactory, jsInProcessDaemonFactory, goDaemonFactory } = require('./daemon-factory')

exports.createProc = addrs => jsInProcessDaemonFactory.spawn({
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

exports.createJs = addrs => jsDaemonFactory.spawn({
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

exports.createGo = addrs => goDaemonFactory.spawn({
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

exports.clean = () => Promise.all([
  jsInProcessDaemonFactory.clean(),
  jsDaemonFactory.clean(),
  goDaemonFactory.clean()
])

const data = crypto.randomBytes(128)
exports.send = async (nodeA, nodeB) => {
  const { cid } = await last(nodeA.api.add(data))
  const buffer = await concat(nodeB.api.cat(cid))

  expect(buffer.slice()).to.deep.equal(data)
}

const getWsAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => {
    return a.includes('/ws') && !a.includes('/p2p-webrtc-star')
  })

exports.getWsAddr = getWsAddr

const getWsStarAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-websocket-star'))

exports.getWsStarAddr = getWsStarAddr

const getWrtcStarAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-webrtc-star'))

exports.getWrtcStarAddr = getWrtcStarAddr

const getTcpAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

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
