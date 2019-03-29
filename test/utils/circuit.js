'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const waterfall = require('async/waterfall')
const series = require('async/series')

const crypto = require('crypto')

const IPFS = require('ipfs')

const DaemonFactory = require('ipfsd-ctl')
const jsDf = DaemonFactory.create({ type: 'js' })
const goDf = DaemonFactory.create({ type: 'go' })
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

exports.createProcNode = (addrs, callback) => {
  procDf.spawn({
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
  }, (err, ipfsd) => {
    expect(err).to.not.exist()
    ipfsd.api.id((err, id) => {
      callback(err, { ipfsd, addrs: id.addresses })
    })
  })
}

exports.createJsNode = (addrs, callback) => {
  jsDf.spawn({
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
  }, (err, ipfsd) => {
    expect(err).to.not.exist()
    ipfsd.api.id((err, id) => {
      callback(err, { ipfsd, addrs: id.addresses })
    })
  })
}

exports.createGoNode = (addrs, callback) => {
  goDf.spawn({
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
  }, (err, ipfsd) => {
    expect(err).to.not.exist()
    ipfsd.api.id((err, id) => {
      const addrs = [].concat(id.addresses, [`/p2p-circuit/ipfs/${id.id}`])
      callback(err, { ipfsd, addrs: addrs })
    })
  })
}

const data = crypto.randomBytes(128)
exports.send = (nodeA, nodeB, callback) => {
  waterfall([
    (cb) => nodeA.add(data, cb),
    (res, cb) => nodeB.cat(res[0].hash, cb),
    (buffer, cb) => {
      expect(buffer).to.deep.equal(data)
      cb()
    }
  ], callback)
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

const connect = (nodeA, nodeB, relay, timeout, callback) => {
  if (typeof timeout === 'function') {
    callback = timeout
    timeout = 1000
  }

  series([
    (cb) => nodeA.ipfsd.api.swarm.connect(getWsAddr(relay.addrs), cb),
    (cb) => nodeB.ipfsd.api.swarm.connect(getWsAddr(relay.addrs), cb),
    // TODO: needed until https://github.com/ipfs/interop/issues/17 is resolved
    (cb) => setTimeout(cb, timeout),
    (cb) => nodeA.ipfsd.api.swarm.connect(getCircuitAddr(nodeB.addrs), cb)
  ], callback)
}

exports.connect = connect

exports.connWithTimeout = (timeout) => {
  return (nodeA, nodeB, relay, callback) => {
    connect(nodeA, nodeB, relay, timeout, callback)
  }
}
