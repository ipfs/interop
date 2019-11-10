'use strict'

const delay = require('delay')
const { expect } = require('./chai')

const { spawnGoDaemon, spawnJsDaemon } = require('./daemon')

const crypto = require('crypto')

let IPFS

if (process.env.IPFS_JS_MODULE) {
  IPFS = require(process.env.IPFS_JS_MODULE)
} else {
  IPFS = require('ipfs')
}

const DaemonFactory = require('ipfsd-ctl')
const procDf = DaemonFactory.create({ type: 'proc', exec: IPFS })

const baseConf = {
  Bootstrap: [],
  Addresses: {
    API: '/ip4/0.0.0.0/tcp/0',
    Gateway: '/ip4/0.0.0.0/tcp/0'
  },
  Discovery: {
    MDNS: {
      Enabled: false
    }
  }
}

exports.createProcNode = async (addrs) => {
  const ipfsd = await procDf.spawn({
    initOptions: { bits: 512 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      }
    }),
    relay: {
      enabled: true,
      hop: {
        enabled: true
      }
    }
  })

  const id = await ipfsd.api.id()

  return { ipfsd, addrs: id.addresses }
}

exports.createJsNode = async (addrs) => {
  const ipfsd = await spawnJsDaemon({
    initOptions: { bits: 512 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      },
      relay: {
        enabled: true,
        hop: {
          enabled: true
        }
      }
    })
  })

  const ipfsdId = await ipfsd.api.id()

  return { ipfsd, addrs: ipfsdId.addresses }
}

exports.createGoNode = async (addrs) => {
  const ipfsd = await spawnGoDaemon({
    initOptions: { bits: 1024 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      },
      Swarm: {
        DisableRelay: false,
        EnableRelayHop: true
      }
    })
  })

  const ipfsdId = await ipfsd.api.id()
  const _addrs = [].concat(ipfsdId.addresses, [`/p2p-circuit/ipfs/${ipfsdId.id}`])

  return { ipfsd, addrs: _addrs }
}

const data = crypto.randomBytes(128)
exports.send = async (nodeA, nodeB) => {
  const res = await nodeA.add(data)
  const buffer = await nodeB.cat(res[0].hash)

  expect(buffer).to.deep.equal(data)
}

const getWsAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => {
    return a.includes('/ws') && !a.includes('/p2p-websocket-star')
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

const getCircuitAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-circuit/ipfs'))

exports.getCircuitAddr = getCircuitAddr

const connect = async (nodeA, nodeB, relay, timeout = 1000) => {
  await nodeA.ipfsd.api.swarm.connect(getWsAddr(relay.addrs))
  await nodeB.ipfsd.api.swarm.connect(getWsAddr(relay.addrs))
  // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
  await delay(timeout)
  await nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs))
}

exports.connect = connect

exports.connWithTimeout = (timeout) => {
  return (nodeA, nodeB, relay) => {
    connect(nodeA, nodeB, relay, timeout)
  }
}
