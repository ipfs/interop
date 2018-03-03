'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const waterfall = require('async/waterfall')
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
      Enabled:
        false
    }
  }
}

exports.setUpProcNode = (addrs, hop, callback) => {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  procDf.spawn({
    initOptions: { bits: 512 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      },
      EXPERIMENTAL: {
        relay: {
          enabled: true,
          hop: {
            enabled: hop
          }
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

exports.setUpJsNode = (addrs, hop, callback) => {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  jsDf.spawn({
    initOptions: { bits: 512 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      },
      EXPERIMENTAL: {
        relay: {
          enabled: true,
          hop: {
            enabled: hop
          }
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

exports.setUpGoNode = (addrs, hop, callback) => {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  goDf.spawn({
    initOptions: { bits: 1024 },
    config: Object.assign({}, baseConf, {
      Addresses: {
        Swarm: addrs
      },
      Swarm: {
        DisableRelay: false,
        EnableRelayHop: hop
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

exports.create = (nodes, callback) => {
  series(
    Object.keys(nodes).map((key) => (cb) => {
      const node = nodes[key]
      return node.exec(node.addrs, true, (err, res) => {
        expect(err).to.not.exist()
        cb(null, {
          name: key,
          node: res
        })
      })
    }), (err, res) => {
      if (err) { return callback(err) }
      callback(null, res)
    })
}

exports.connect = (connect, nodes, callback) => {
  const seq = connect.map((step) => {
    const nodeA = nodes.find((node) => node.name === step[0].name)
    const nodeB = nodes.find((node) => node.name === step[1].name)

    return (cb) => {
      const addr = step[0].parser(nodeB.node.addrs)
      nodeA.node.ipfsd.api.swarm.connect(addr, (err) => setTimeout(cb, 1000, err))
    }
  })

  series(seq.map((func) => (cb) => func(cb)), callback)
}

const data = crypto.randomBytes(128)
exports.send = (send, nodes, callback) => {
  const nodeA = nodes.find((node) => node.name === send[0]).node.ipfsd.api
  const nodeB = nodes.find((node) => node.name === send[1]).node.ipfsd.api
  waterfall([
    (cb) => nodeA.files.add(data, cb),
    (res, cb) => nodeB.files.cat(res[0].hash, cb),
    (buffer, cb) => {
      expect(buffer).to.deep.equal(data)
      cb()
    }
  ], (err) => {
    expect(err).to.not.exist()
    callback()
  })
}

exports.wsAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => {
    return a.includes('/ws') && !a.includes('/p2p-websocket-star')
  })

exports.wsStarAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-websocket-star'))

exports.wrtcStarAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-webrtc-star'))

exports.tcpAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => !a.includes('/ws') && !a.includes('/p2p-websocket-star'))

exports.circuitAddr = (addrs) => addrs
  .map((a) => a.toString())
  .find((a) => a.includes('/p2p-circuit/ipfs'))
