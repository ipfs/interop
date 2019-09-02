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
const each = require('async/each')
const parallel = require('async/parallel')
const times = require('async/times')

const waitFor = require('./utils/wait-for-fn')

const DaemonFactory = require('ipfsd-ctl')
const IPFS = require('ipfs')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'proc', exec: IPFS })

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
    libp2p: {
      config: {
        dht: {
          enabled: true
        }
      }
    }
  }, callback)
}

const getNodeAddr = (node, callback) => {
  node.api.id((err, res) => {
    expect(err).to.not.exist()
    expect(res.id).to.exist()

    callback(null, res.addresses[0])
  })
}

const addFileAndCat = (addDaemon, catDaemons, data, callback) => {
  addDaemon.api.add(data, (err, res) => {
    expect(err).to.not.exist()

    each(catDaemons, (daemon, cb) => {
      daemon.api.cat(res[0].hash, (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.equalBytes(data)
        cb()
      })
    }, callback)
  })
}

describe('kad-dht', () => {
  describe('kad-dht with a single bootstrap node', () => {
    describe('a JS network', () => {
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const peersToSpawn = 3
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        times(peersToSpawn, (_, next) => {
          spawnJsDaemon(bootstrap, (err, node) => {
            expect(err).to.not.exist()
            nodes.push(node)
            next(err, node)
          })
        }, (err) => {
          expect(err).to.not.exist()

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === peersToSpawn)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(100 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a GO network', () => {
      const peersToSpawn = 3
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        times(peersToSpawn, (_, next) => {
          spawnGoDaemon(bootstrap, (err, node) => {
            expect(err).to.not.exist()
            nodes.push(node)
            next(err, node)
          })
        }, (err) => {
          expect(err).to.not.exist()

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === peersToSpawn)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a JS bootstrap node in the land of Go', () => {
      const peersToSpawn = 3
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        times(peersToSpawn, (_, next) => {
          spawnGoDaemon(bootstrap, (err, node) => {
            expect(err).to.not.exist()
            nodes.push(node)
            next(err, node)
          })
        }, (err) => {
          expect(err).to.not.exist()

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === peersToSpawn)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(60 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a Go bootstrap node in the land of JS', () => {
      const peersToSpawn = 3
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(80 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        times(peersToSpawn, (_, next) => {
          spawnJsDaemon(bootstrap, (err, node) => {
            expect(err).to.not.exist()
            nodes.push(node)
            next(err, node)
          })
        }, (err) => {
          expect(err).to.not.exist()

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === peersToSpawn)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(120 * 1000)
        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a JS bootstrap node in an hybrid land', () => {
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnJsDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        parallel([
          (cb) => spawnJsDaemon(bootstrap, cb),
          (cb) => spawnGoDaemon(bootstrap, cb),
          (cb) => spawnJsDaemon(bootstrap, cb)
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === 3)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
      })

      it('should get from the network after being added', function (done) {
        this.timeout(140 * 1000)

        addFileAndCat(nodes[1], [nodes[2], nodes[3]], data, done)
      })
    })

    describe('a Go bootstrap node in an hybrid land', () => {
      let bootstrapAddr
      const nodes = []
      const data = crypto.randomBytes(9001)

      // spawn bootstrap daemon and get address
      before(function (done) {
        this.timeout(60 * 1000)

        spawnGoDaemon([], (err, node) => {
          expect(err).to.not.exist()
          nodes.push(node)

          getNodeAddr(nodes[0], (err, res) => {
            expect(err).to.not.exist()
            bootstrapAddr = res
            done()
          })
        })
      })

      // spawn daemons
      before(function (done) {
        this.timeout(70 * 1000)
        const bootstrap = bootstrapAddr ? [bootstrapAddr] : []

        parallel([
          (cb) => spawnJsDaemon(bootstrap, cb),
          (cb) => spawnGoDaemon(bootstrap, cb),
          (cb) => spawnJsDaemon(bootstrap, cb)
        ], (err, spawnedNodes) => {
          expect(err).to.not.exist()
          spawnedNodes.forEach((node) => nodes.push(node))

          const testDhtReady = (cb) => {
            nodes[0].api.swarm.peers((err, peers) => {
              if (err) {
                return cb(err)
              }
              cb(null, peers.length === 3)
            })
          }

          // Wait for peers to have each other on the DHT
          waitFor(testDhtReady, {
            name: 'dht peers ready',
            timeout: 30 * 1000,
            interval: 5 * 1000
          }, done)
        })
      })

      after(function (done) {
        this.timeout(80 * 1000)
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
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

      /**
       * Make connections between nodes
       * +-+       +-+
       * |0+-----> |1|
       * +++       +++
       *  ^         |
       *  |         |
       *  |         v
       * +++       +++
       * |3|       |2|
       * +-+       +-+
       */
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
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
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

      /**
       * Make connections between nodes
       * +-+       +-+
       * |0+-----> |1|
       * +++       +++
       *  ^         |
       *  |         |
       *  |         v
       * +++       +++
       * |3|       |2|
       * +-+       +-+
       */
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
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
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
        each(nodes, (node, cb) => {
          node.stop(cb)
        }, done)
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
