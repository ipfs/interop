/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const chaiBytes = require('chai-bytes')
const expect = chai.expect
chai.use(dirtyChai)
chai.use(chaiBytes)

const series = require('async/series')
const crypto = require('crypto')
const parallel = require('async/parallel')
const waterfall = require('async/waterfall')

const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

const getConfig = (bootstrap) => ({
  Bootstrap: bootstrap,
  Discovery: {
    MDNS: {
      Enabled: false
    },
    webRTCStar: {
      Enabled: false
    }
  }
})

const spawnGoDaemon = (bootstrap = [], callback) => {
  goDf.spawn({
    initOptions: { bits: 1024 },
    config: getConfig(bootstrap)
  }, callback)
}

const spawnJsDaemon = (bootstrap = [], callback) => {
  jsDf.spawn({
    initOptions: { bits: 512 },
    config: getConfig(bootstrap),
    args: ['--enable-dht-experiment']
  }, callback)
}

const getNodeId = (node, callback) => {
  node.api.id((err, res) => {
    expect(err).to.not.exist()
    expect(res.id).to.exist()

    callback(null, res.addresses[0])
  })
}

describe.only('kad-dht', () => {
  describe.only('a JS network', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnJsDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(100 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(100 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })

  describe('a GO network', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnGoDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(100 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(60 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })

  describe('a JS bootstrap node in the land of Go', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnJsDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(70 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(60 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })

  describe('a Go bootstrap node in the land of JS', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnGoDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(70 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(100 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })

  describe('a JS bootstrap node in an hybrid land', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnJsDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(70 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(60 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })

  describe('a Go bootstrap node in an hybrid land', () => {
    let bootstrapAddr
    let node0
    let node1
    let node2
    let node3
    let data

    // spawn bootstrap daemon and get address
    before(function (done) {
      this.timeout(60 * 1000)

      spawnGoDaemon([], (err, node) => {
        expect(err).to.not.exist()
        node0 = node

        getNodeId(node0, (err, res) => {
          expect(err).to.not.exist()
          bootstrapAddr = res
          done()
        })
      })
    })

    // spawn daemons
    before(function (done) {
      this.timeout(70 * 1000)
      const bootstrap = [bootstrapAddr]

      parallel([
        (cb) => spawnJsDaemon(bootstrap, cb),
        (cb) => spawnGoDaemon(bootstrap, cb),
        (cb) => spawnJsDaemon(bootstrap, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        node1 = nodes[0]
        node2 = nodes[1]
        node3 = nodes[2]
        done()
      })
    })

    // create data
    before(function (done) {
      data = crypto.randomBytes(9001)
      done()
    })

    after(function (done) {
      this.timeout(70 * 1000)
      series([
        (cb) => node1.stop(cb),
        (cb) => node2.stop(cb),
        (cb) => node3.stop(cb),
        (cb) => node0.stop(cb)
      ], done)
    })

    it('should get from the network after being added', function (done) {
      this.timeout(60 * 1000)

      node1.api.add(data, (err, res) => {
        expect(err).to.not.exist()

        parallel([
          (cb) => node2.api.cat(res[0].hash, cb),
          (cb) => node3.api.cat(res[0].hash, cb)
        ], (err, res) => {
          expect(err).to.not.exist()
          expect(res[0]).to.equalBytes(data)
          expect(res[1]).to.equalBytes(data)
          done()
        })
      })
    })
  })
})
