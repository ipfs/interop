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
  Discovery: {
    MDNS: {
      Enabled:
        false
    }
  }
}

const base = '/ip4/127.0.0.1/tcp'

function setupInProcNode (factory, addrs, hop, callback) {
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
      callback(err, { ipfsd, addrs: circuitFilter(id.addresses) })
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
      callback(err, { ipfsd, addrs: circuitFilter(id.addresses) })
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
      callback(err, { ipfsd, addrs: circuitFilter(id.addresses) })
    })
  })
}

const circuitFilter = (addrs) => addrs.map((a) => a.toString()).filter((a) => !a.includes('/p2p-circuit'))
const wsAddr = (addrs) => addrs.map((a) => a.toString()).find((a) => a.includes('/ws'))
const tcpAddr = (addrs) => addrs.map((a) => a.toString()).find((a) => !a.includes('/ws'))

function tests (relayType) {
  describe(`jsWS <-> ${relayType} <-> goTCP`, function () {
    this.timeout(50 * 1000)

    let goTCP
    let goTCPAddr
    let jsWS
    let jsWSAddr
    let jsWSCircuitAddr

    let nodes

    before(function (done) {
      parallel([
        (cb) => setUpGoNode([`${base}/35003`], cb),
        (cb) => setUpJsNode([`${base}/35004/ws`], cb)
      ], function (err, res) {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        goTCPAddr = tcpAddr(res[0].addrs)
        goTCP = res[0].ipfsd.api

        jsWSAddr = wsAddr(res[1].addrs)
        jsWS = res[1].ipfsd.api
        jsWSCircuitAddr = `/p2p-circuit/ipfs/${multiaddr(jsWSAddr).getPeerId()}`

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(goTCPAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(jsWSAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => goTCP.swarm.connect(jsWSCircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => goTCP.files.add(data, cb),
        (res, cb) => jsWS.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`jsWS <-> ${relayType} <-> jsTCP`, function () {
    this.timeout(50 * 1000)
    let jsTCP
    let jsTCPAddr

    let jsWS
    let jsWSAddr
    let jsTCPCircuitAddr

    let nodes
    before((done) => {
      parallel([
        (cb) => setUpJsNode([`${base}/35003`], cb),
        (cb) => setUpJsNode([`${base}/35004/ws`], cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        jsTCP = res[0].ipfsd.api
        jsTCPAddr = tcpAddr(res[0].addrs)
        jsTCPCircuitAddr = `/p2p-circuit/ipfs/${multiaddr(jsTCPAddr).getPeerId()}`

        jsWS = res[1].ipfsd.api
        jsWSAddr = wsAddr(res[1].addrs)

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(jsTCPAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(jsWSAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => jsWS.swarm.connect(jsTCPCircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => jsTCP.files.add(data, cb),
        (res, cb) => jsWS.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`goWS <-> ${relayType} <-> goTCP`, function () {
    this.timeout(50 * 1000)
    let goTCP
    let goTCPAddr
    let goTCPCircuitAddr

    let goWS
    let goWSAddr

    let nodes
    before((done) => {
      parallel([
        (cb) => setUpGoNode([`${base}/35003`], cb),
        (cb) => setUpGoNode([`${base}/35004/ws`], cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        nodes = res.map((node) => node.ipfsd)

        goTCP = res[0].ipfsd.api
        goTCPAddr = tcpAddr(res[0].addrs)
        goTCPCircuitAddr = `/p2p-circuit/ipfs/${multiaddr(goTCPAddr).getPeerId()}`

        goWS = res[1].ipfsd.api
        goWSAddr = wsAddr(res[1].addrs)

        done()
      })
    })

    after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

    it('should connect', function (done) {
      series([
        (cb) => this.relay.api.swarm.connect(goTCPAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => this.relay.api.swarm.connect(goWSAddr, cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => goWS.swarm.connect(goTCPCircuitAddr, cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => goTCP.files.add(data, cb),
        (res, cb) => goWS.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`browser <-> ${relayType} <-> browser`, function () {
    if (isNode) {
      return
    }

    this.timeout(90 * 1000)

    let browserNode1
    let browserNode2

    // let browserNodeId1
    let browserNode2Addrs

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setupInProcNode([], false, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        browserNode1 = nodes[0].ipfsd.api
        browserNode2 = nodes[1].ipfsd.api

        browserNode2Addrs = nodes[1].addrs
        done()
      })
    })

    it('should connect', function (done) {
      series([
        (cb) => browserNode1.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => browserNode2.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => browserNode1.swarm.connect(browserNode2Addrs[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => browserNode1.files.add(data, cb),
        (res, cb) => browserNode2.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`jsTCP <-> ${relayType} <-> browser`, function () {
    if (isNode) {
      return
    }

    this.timeout(50 * 1000)

    let browserNode1
    let jsTCP
    let jsTCPAddrs

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setUpJsNode([`${base}/35003`], cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        browserNode1 = nodes[0]

        jsTCP = nodes[1].ipfsd
        jsTCPAddrs = nodes[1].addrs

        done()
      })
    })

    after((done) => jsTCP.stop(done))

    it('should connect and transfer', function (done) {
      series([
        (cb) => browserNode1.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => jsTCP.api.swarm.connect(tcpAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => browserNode1.swarm.connect(jsTCPAddrs[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => browserNode1.files.add(data, cb),
        (res, cb) => jsTCP.files.cat(res[0].hash, cb),
        (buffer, cb) => {
          expect(buffer).to.deep.equal(data)
          cb()
        }
      ], done)
    })
  })

  describe(`goTCP <-> ${relayType} <-> browser`, function () {
    if (isNode) {
      return
    }

    this.timeout(50 * 1000)

    let browserNode1
    let goTCP
    let goTCPAddrs

    before(function (done) {
      parallel([
        (cb) => setupInProcNode([], false, cb),
        (cb) => setUpGoNode([`${base}/35003`], cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        browserNode1 = nodes[0]

        goTCP = nodes[1].ipfsd
        goTCPAddrs = nodes[1].addrs

        done()
      })
    })

    after((done) => goTCP.stop(done))

    it('should connect', function (done) {
      series([
        (cb) => browserNode1.swarm.connect(wsAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => goTCP.api.swarm.connect(tcpAddr(this.relayAddrs), cb),
        (cb) => setTimeout(cb, 1000),
        (cb) => browserNode1.swarm.connect(goTCPAddrs[0], cb)
      ], done)
    })

    it('should transfer', function (done) {
      const data = crypto.randomBytes(128)
      waterfall([
        (cb) => browserNode1.files.add(data, cb),
        (res, cb) => goTCP.files.cat(res[0].hash, cb),
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

      setUpJsNode([`${base}/35001/ws`, `${base}/35002`], true, (err, res) => {
        expect(err).to.not.exist()
        this.relay = res.ipfsd
        this.relayAddrs = res.addrs
        done()
      })
    })

    after(function (done) { this.relay.stop(done) })

    describe('test js relay', function () {
      tests('jsRelay')
    })
  })

  describe('go relay', function () {
    this.relay = null
    this.relayAddrs = null

    before(function (done) {
      this.timeout(50 * 1000)

      setUpGoNode([`${base}/35001/ws`, `${base}/35002`], true, (err, res) => {
        expect(err).to.not.exist()
        this.relay = res.ipfsd
        this.relayAddrs = res.addrs
        done()
      })
    })

    after(function (done) { this.relay.stop(done) })

    describe('test go relay', function () {
      tests('goRelay')
    })
  })
})
