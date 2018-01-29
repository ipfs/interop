/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const parallel = require('async/parallel')
const series = require('async/series')
const waterfall = require('async/waterfall')
const multiaddr = require('multiaddr')
const crypto = require('crypto')
const IPFS = require('ipfs')

const isNode = require('detect-node')

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

const base = '/ip4/127.0.0.1/tcp'

function setupInProcNode (addrs, hop, callback) {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  procDf.spawn({
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

function setUpJsNode (addrs, hop, callback) {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  jsDf.spawn({
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

function setUpGoNode (addrs, hop, callback) {
  if (typeof hop === 'function') {
    callback = hop
    hop = false
  }

  goDf.spawn({
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
      callback(err, { ipfsd, addrs: id.addresses })
    })
  })
}

const wsAddr = (addrs) => addrs.map((a) => a.toString()).find((a) => a.includes('/ws'))
const tcpAddr = (addrs) => addrs.map((a) => a.toString()).find((a) => !a.includes('/ws'))

function tests (relay, parseAddrA, parseAddrB) {
  describe(`js <-> ${relay} relay <-> go`, function () {
    this.timeout(80 * 1000)

    let nodeA
    let nodeAAddr
    let nodeB
    let nodeBAddr
    let nodeBCircuitAddr

    let nodes
    before(function (done) {
      parallel([
        (cb) => setUpGoNode([this.addrA], cb),
        (cb) => setUpJsNode([this.addrB], cb)
      ], function (err, res) {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        nodeAAddr = parseAddrA(res[0].addrs)
        nodeA = res[0].ipfsd.api

        nodeBAddr = parseAddrB(res[1].addrs)

        nodeB = res[1].ipfsd.api
        nodeBCircuitAddr = `/p2p-circuit/ipfs/${multiaddr(nodeBAddr).getPeerId()}`

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(nodeAAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(nodeBAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeA.swarm.connect(nodeBCircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`js <-> ${relay} relay <-> js`, function () {
    this.timeout(80 * 1000)
    let nodeA
    let nodeAAddr

    let nodeB
    let nodeBAddr
    let nodeBCircuitAddr

    let nodes
    before(function (done) {
      parallel([
        (cb) => setUpJsNode([this.addrA], cb),
        (cb) => setUpJsNode([this.addrB], cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        nodeA = res[0].ipfsd.api
        nodeAAddr = parseAddrA(res[0].addrs)
        nodeBCircuitAddr = `/p2p-circuit/ipfs/${multiaddr(nodeAAddr).getPeerId()}`

        nodeB = res[1].ipfsd.api
        nodeBAddr = parseAddrB(res[1].addrs)

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(nodeAAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(nodeBAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(nodeBCircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`go <-> ${relay} relay <-> go`, function () {
    this.timeout(80 * 1000)
    let nodeA
    let nodeAAddr
    let nodeACircuitAddr

    let nodeB
    let nodeBAddr

    let nodes
    before(function (done) {
      parallel([
        (cb) => setUpGoNode([this.addrA], cb),
        (cb) => setUpGoNode([this.addrB], cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        nodeA = res[0].ipfsd.api
        nodeAAddr = parseAddrA(res[0].addrs)
        nodeACircuitAddr = `/p2p-circuit/ipfs/${multiaddr(nodeAAddr).getPeerId()}`

        nodeB = res[1].ipfsd.api
        nodeBAddr = parseAddrB(res[1].addrs)

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(nodeAAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(nodeBAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(nodeACircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`go <-> ${relay} relay <-> js`, function () {
    this.timeout(80 * 1000)
    let nodeA
    let nodeAAddr
    let nodeACircuitAddr

    let nodeB
    let nodeBAddr

    let nodes
    before(function (done) {
      parallel([
        (cb) => setUpGoNode([this.addrA], cb),
        (cb) => setUpJsNode([this.addrB], cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        nodeA = res[0].ipfsd.api
        nodeAAddr = parseAddrA(res[0].addrs)
        nodeACircuitAddr = `/p2p-circuit/ipfs/${multiaddr(nodeAAddr).getPeerId()}`

        nodeB = res[1].ipfsd.api
        nodeBAddr = parseAddrB(res[1].addrs)

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(nodeAAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(nodeBAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(nodeACircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`js <-> ${relay} relay <-> browser`, function () {
    if (isNode) {
      return
    }

    this.timeout(90 * 1000)

    let nodeA
    let nodeB
    let nodeBIpfsd
    let nodeBAddr

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setUpJsNode([this.addrA], cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        nodeA = nodes[0].ipfsd.api
        nodeB = nodes[1].ipfsd.api
        nodeBIpfsd = nodes[1].ipfsd
        nodeBAddr = nodes[1].addrs

        done()
      })
    })

    after((done) => nodeBIpfsd.stop(done))

    it('should connect', function (done) {
      series([
        (cb) => nodeA.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(tcpAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeA.swarm.connect(nodeBAddr[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`go <-> ${relay} relay <-> browser`, function () {
    if (isNode) {
      return
    }

    this.timeout(90 * 1000)

    let nodeA
    let nodeB
    let nodeBIpfsd
    let nodeBAddrs

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setUpGoNode([this.addrA], cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        nodeA = nodes[0].ipfsd.api
        nodeB = nodes[1].ipfsd.api
        nodeBIpfsd = nodes[1].ipfsd
        nodeBAddrs = nodes[1].addrs

        done()
      })
    })

    after((done) => nodeBIpfsd.stop(done))

    it('should connect', function (done) {
      series([
        (cb) => nodeA.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(tcpAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeA.swarm.connect(nodeBAddrs[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`browser <-> ${relay} relay <-> browser`, function () {
    if (isNode || relay === 'browser') {
      return
    }

    this.timeout(90 * 1000)

    let nodeA
    let nodeB

    // let nodeAId1
    let nodeBAddrs

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setupInProcNode([], false, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        nodeA = nodes[0].ipfsd.api
        nodeB = nodes[1].ipfsd.api

        nodeBAddrs = nodes[1].addrs
        done()
      })
    })

    it('should connect', function (done) {
      series([
        (cb) => nodeA.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeB.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => nodeA.swarm.connect(nodeBAddrs[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => nodeA.files.add(data, cb),
        (res, cb) => nodeB.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })
}

describe('circuit', () => {
  describe('js relay', function () {
    this.relay = null
    this.relayAddrs = null

    before(function (done) {
      this.timeout(50 * 1000)

      this.addrA = `${base}/35003`
      this.addrB = `${base}/35004/ws`

      setUpJsNode([`${base}/35001/ws`, `${base}/35002`], true, (err, res) => {
        expect(err).to.not.exist()
        this.relay = res.ipfsd
        this.relayAddrs = res.addrs
        done()
      })
    })

    after(function (done) { this.relay.stop(done) })

    tests('js', tcpAddr, wsAddr)
  })

  describe('go relay', function () {
    this.relay = null
    this.relayAddrs = null

    before(function (done) {
      this.timeout(50 * 1000)

      this.addrA = `${base}/35003`
      this.addrB = `${base}/35004/ws`

      setUpGoNode([`${base}/35001/ws`, `${base}/35002`], true, (err, res) => {
        expect(err).to.not.exist()
        this.relay = res.ipfsd
        this.relayAddrs = res.addrs
        done()
      })
    })

    after(function (done) { this.relay.stop(done) })

    tests('go', tcpAddr, wsAddr)
  })

  describe('browser relay', function () {
    if (isNode) {
      return
    }

    this.relay = null
    this.relayAddrs = null

    before(function (done) {
      this.timeout(50 * 1000)

      this.addrA = `${base}/35003/ws`
      this.addrB = `${base}/35004/ws`

      setupInProcNode([], true, (err, res) => {
        expect(err).to.not.exist()
        this.relay = res.ipfsd
        this.relayAddrs = res.addrs
        done()
      })
    })

    after(function (done) { this.relay.stop(done) })

    tests('browser', wsAddr, wsAddr)
  })
})
