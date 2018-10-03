/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const chaiBytes = require('chai-bytes')
const expect = chai.expect
chai.use(dirtyChai)
chai.use(chaiBytes)

const crypto = require('crypto')
const parallel = require('async/parallel')

const DaemonFactory = require('ipfsd-ctl')
const IPFS = require('ipfs')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'proc', exec: IPFS })
// const jsDf = DaemonFactory.create({ type: 'js' }) CHANGE TO HERE once UPDATED

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

const getBootstrapAddr = (node, callback) => {
  node.api.id((err, res) => {
    expect(err).to.not.exist()
    expect(res.id).to.exist()

    callback(null, res.addresses[0])
  })
}

const addFileAndCat = (addDaemon, catDaemons, data, callback) => {
  addDaemon.api.files.add(data, (err, res) => {
    expect(err).to.not.exist()

    parallel(catDaemons.map((daemon) => (cb) => daemon.api.files.cat(res[0].hash, cb)), (err, res) => {
      expect(err).to.not.exist()
      res.forEach((resData) => {
        expect(resData).to.equalBytes(data)
      })
      callback()
    })
  })
}

describe('kad-dht', () => {
  describe('kad-dht with a single bootstrap node', () => {
    describe('a JS network', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(100 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a GO network', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a JS bootstrap node in the land of Go', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a Go bootstrap node in the land of JS', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(100 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a JS bootstrap node in an hybrid land', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)

        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a Go bootstrap node in an hybrid land', () => {
      let bootstrapAddr
      let nodes = []
      let data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getBootstrapAddr(nodes[0], (err, res) => {
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
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))
          setTimeout(done, 25000) // Wait for peers to have each other on the DHT
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)

        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })
  })

  describe('kad-dht with connections per peer', () => {
    describe('a JS node in the land of Go', () => {
      let nodes = []

      // Spawn daemons
      before(function (done) {
        this.timeout(60 * 1000)

        parallel([
          (cb) => spawnGoDaemon([], cb),
          (cb) => spawnGoDaemon([], cb),
          (cb) => spawnGoDaemon([], cb),
          (cb) => spawnJsDaemon([], cb)
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          nodes = spawnedNodes
          done()
        })
      })

      // make connections
      before(function (done) {
        this.timeout(60 * 1000)

        parallel(nodes.map((node) => (cb) => node.api.id(cb)), (err, ids) => {
          expect(err).to.not.exist()
          parallel([
            (cb) => nodes[3].api.swarm.connect(ids[0].addresses[0], cb),
            (cb) => nodes[0].api.swarm.connect(ids[1].addresses[0], cb),
            (cb) => nodes[1].api.swarm.connect(ids[2].addresses[0], cb)
          ], done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('one hop', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[0], [nodes[3]], data, done)
      })

      it('two hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[1], [nodes[3]], data, done)
      })

      it('three hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[2], [nodes[3]], data, done)
      })
    })

    describe('a Go node in the land of JS', () => {
      let nodes = []

      // Spawn daemons
      before(function (done) {
        this.timeout(60 * 1000)

        parallel([
          (cb) => spawnJsDaemon([], cb),
          (cb) => spawnJsDaemon([], cb),
          (cb) => spawnJsDaemon([], cb),
          (cb) => spawnGoDaemon([], cb)
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          nodes = spawnedNodes
          done()
        })
      })

      // make connections
      before(function (done) {
        this.timeout(60 * 1000)

        parallel(nodes.map((node) => (cb) => node.api.id(cb)), (err, ids) => {
          expect(err).to.not.exist()
          parallel([
            (cb) => nodes[3].api.swarm.connect(ids[0].addresses[0], cb),
            (cb) => nodes[0].api.swarm.connect(ids[1].addresses[0], cb),
            (cb) => nodes[1].api.swarm.connect(ids[2].addresses[0], cb)
          ], done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('one hop', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[0], [nodes[3]], data, done)
      })

      it('two hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[1], [nodes[3]], data, done)
      })

      it('three hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[2], [nodes[3]], data, done)
      })
    })

    describe('hybrid', () => {
      let nodes = []

      // Spawn daemons
      before(function (done) {
        this.timeout(60 * 1000)

        parallel([
          (cb) => spawnJsDaemon([], cb),
          (cb) => spawnGoDaemon([], cb),
          (cb) => spawnJsDaemon([], cb),
          (cb) => spawnGoDaemon([], cb)
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          nodes = spawnedNodes
          done()
        })
      })

      // make connections
      before(function (done) {
        this.timeout(60 * 1000)

        parallel(nodes.map((node) => (cb) => node.api.id(cb)), (err, ids) => {
          expect(err).to.not.exist()
          parallel([
            (cb) => nodes[3].api.swarm.connect(ids[0].addresses[0], cb),
            (cb) => nodes[0].api.swarm.connect(ids[1].addresses[0], cb),
            (cb) => nodes[1].api.swarm.connect(ids[2].addresses[0], cb)
          ], done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
      })

      it('one hop', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[0], [nodes[3]], data, done)
      })

      it('two hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[1], [nodes[3]], data, done)
      })

      it('three hops', function (done) {
        this.timeout(85 * 1000)
        const data = crypto.randomBytes(9001)

        addFileAndCat(nodes[2], [nodes[3]], data, done)
      })
    })
  })
})
