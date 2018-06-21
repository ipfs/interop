/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const parallel = require('async/parallel')
const waterfall = require('async/waterfall')
const crypto = require('crypto')
const os = require('os')
const path = require('path')
const hat = require('hat')
const fs = require('fs')
const writeKey = require('libp2p-pnet').generate

const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

// Create network keys
const networkAKey = Buffer.alloc(95)
const networkBKey = Buffer.alloc(95)
writeKey(networkAKey)
writeKey(networkBKey)

const config = {
  Bootstrap: [],
  Discovery: {
    MDNS: {
      Enabled: false
    },
    webRTCStar: {
      Enabled: false
    }
  }
}

const goPrivateRepoPath = path.join(os.tmpdir(), hat())
const goSameNetworkRepoPath = path.join(os.tmpdir(), hat())
const goDiffNetworkRepoPath = path.join(os.tmpdir(), hat())
const jsPrivateRepoPath = path.join(os.tmpdir(), hat())
const jsSameNetworkRepoPath = path.join(os.tmpdir(), hat())
const jsDiffNetworkRepoPath = path.join(os.tmpdir(), hat())

function startIpfsNode (daemonSpawner, repoPath, key, callback) {
  let daemon

  series([
    (cb) => daemonSpawner.spawn({
      disposable: false,
      repoPath: repoPath,
      config: config
    }, (err, node) => {
      daemon = node
      cb(err)
    }),
    (cb) => daemon.init(cb),
    (cb) => fs.writeFile(path.join(repoPath, 'swarm.key'), key, cb),
    (cb) => daemon.start(cb)
  ], (err) => {
    callback(err, daemon)
  })
}

describe('Private network', function () {
  this.timeout(30 * 1000)

  let goPrivateDaemon
  let goSameNetworkDaemon
  let goDiffNetworkDaemon
  let jsPrivateDaemon
  let jsSameNetworkDaemon
  let jsDiffNetworkDaemon
  let goPublicNetworkDaemon
  let jsPublicNetworkDaemon

  before('start the nodes', function (done) {
    this.timeout(45 * 1000)
    parallel([
      // Create and start the private nodes
      (cb) => startIpfsNode(goDf, goPrivateRepoPath, networkAKey, cb),
      (cb) => startIpfsNode(goDf, goSameNetworkRepoPath, networkAKey, cb),
      (cb) => startIpfsNode(goDf, goDiffNetworkRepoPath, networkBKey, cb),
      (cb) => startIpfsNode(jsDf, jsPrivateRepoPath, networkAKey, cb),
      (cb) => startIpfsNode(jsDf, jsSameNetworkRepoPath, networkAKey, cb),
      (cb) => startIpfsNode(jsDf, jsDiffNetworkRepoPath, networkBKey, cb),
      // Create and start a public go node
      (cb) => goDf.spawn((err, daemon) => {
        if (err) {
          return cb(err)
        }

        goPublicNetworkDaemon = daemon
        goPublicNetworkDaemon.start(cb)
      }),
      // Create and start a public js node, js will auto start
      (cb) => jsDf.spawn((err, daemon) => {
        if (err) {
          return cb(err)
        }

        jsPublicNetworkDaemon = daemon
        cb()
      })
    ], (err, nodes) => {
      goPrivateDaemon = nodes.shift()
      goSameNetworkDaemon = nodes.shift()
      goDiffNetworkDaemon = nodes.shift()
      jsPrivateDaemon = nodes.shift()
      jsSameNetworkDaemon = nodes.shift()
      jsDiffNetworkDaemon = nodes.shift()
      done(err)
    })
  })

  after((done) => {
    series([
      (cb) => goPrivateDaemon.stop(cb),
      (cb) => goSameNetworkDaemon.stop(cb),
      (cb) => goDiffNetworkDaemon.stop(cb),
      (cb) => jsPrivateDaemon.stop(cb),
      (cb) => jsSameNetworkDaemon.stop(cb),
      (cb) => jsDiffNetworkDaemon.stop(cb),
      (cb) => goPublicNetworkDaemon.stop(cb),
      (cb) => jsPublicNetworkDaemon.stop(cb)
    ], done)
  })

  describe('js <-> js on the same private network', () => {
    let jsId
    let jsId2

    before('should be able to connect js <-> js', function (done) {
      this.timeout(20 * 1000)

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => jsSameNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids[0]
          jsId2 = ids[1]
          cb()
        }),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.connect(jsId2.addresses[0], cb),
          (cb) => jsSameNetworkDaemon.api.swarm.connect(jsId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => jsSameNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(err).to.not.exist()
          expect(peers[0].map((p) => p.peer.toB58String())).to.include(jsId2.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.include(jsId.id)
          cb()
        })
      ], done)
    })

    after('disconnect the nodes', (done) => {
      jsPrivateDaemon.api.swarm.disconnect(jsId2.addresses[0], done)
    })

    it('should be able to fetch data from js via js', (done) => {
      const data = crypto.randomBytes(1024)
      waterfall([
        (cb) => jsSameNetworkDaemon.api.add(data, cb),
        (res, cb) => jsPrivateDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })
  })

  describe('go <-> js on the same private network', () => {
    let jsId
    let goId

    before('should be able to connect go <-> js', function (done) {
      this.timeout(20 * 1000)

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => goSameNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids[0]
          goId = ids[1]
          cb()
        }),
        (cb) => parallel([
          (cb) => goSameNetworkDaemon.api.swarm.connect(jsId.addresses[0], cb),
          (cb) => jsPrivateDaemon.api.swarm.connect(goId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => goSameNetworkDaemon.api.swarm.peers(cb),
          (cb) => jsPrivateDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(err).to.not.exist()
          expect(peers[0].map((p) => p.peer.toB58String())).to.include(jsId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.include(goId.id)
          cb()
        })
      ], done)
    })

    after('disconnect the nodes', (done) => {
      jsPrivateDaemon.api.swarm.disconnect(goId.addresses[0], done)
    })

    it('should be able to fetch data from go via js', (done) => {
      const data = crypto.randomBytes(1024)
      waterfall([
        (cb) => goSameNetworkDaemon.api.add(data, cb),
        (res, cb) => jsPrivateDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })

    it('should be able to fetch data from js via go', (done) => {
      const data = crypto.randomBytes(1024)
      waterfall([
        (cb) => jsPrivateDaemon.api.add(data, cb),
        (res, cb) => goSameNetworkDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })
  })

  describe('go <-> go on the same private network', () => {
    let goId
    let goSameNetId

    before('should be able to connect go <-> go', function (done) {
      this.timeout(20 * 1000)

      series([
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.id(cb),
          (cb) => goSameNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          goId = ids[0]
          goSameNetId = ids[1]
          cb()
        }),
        (cb) => parallel([
          (cb) => goSameNetworkDaemon.api.swarm.connect(goId.addresses[0], cb),
          (cb) => goPrivateDaemon.api.swarm.connect(goSameNetId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => goSameNetworkDaemon.api.swarm.peers(cb),
          (cb) => goPrivateDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(err).to.not.exist()
          expect(peers[0].map((p) => p.peer.toB58String())).to.include(goId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.include(goSameNetId.id)
          cb()
        })
      ], done)
    })

    after('disconnect the nodes', (done) => {
      goPrivateDaemon.api.swarm.disconnect(goSameNetId.addresses[0], done)
    })

    it('should be able to fetch data from go via go', (done) => {
      const data = crypto.randomBytes(1024)
      waterfall([
        (cb) => goSameNetworkDaemon.api.add(data, cb),
        (res, cb) => goPrivateDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })
  })

  describe('go <-> js on different private networks', () => {
    it('should NOT be able to connect go <-> js', (done) => {
      let jsId
      let goId

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => goDiffNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids.shift()
          goId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.connect(goId.addresses[0], cb),
          (cb) => goDiffNetworkDaemon.api.swarm.connect(jsId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => goDiffNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(goId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(jsId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })

  describe('js <-> js on different private networks', () => {
    it('should NOT be able to connect js <-> js', (done) => {
      let jsId
      let jsDiffId

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => jsDiffNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids.shift()
          jsDiffId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.connect(jsDiffId.addresses[0], cb),
          (cb) => jsDiffNetworkDaemon.api.swarm.connect(jsId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => jsDiffNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(jsDiffId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(jsId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })

  // This will currently timeout, as go will not error
  describe.skip('go <-> go on different private networks', () => {
    it('should NOT be able to connect go <-> go', (done) => {
      let goId
      let goDiffId

      series([
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.id(cb),
          (cb) => goDiffNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          goId = ids.shift()
          goDiffId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.swarm.connect(goDiffId.addresses[0], cb),
          (cb) => goDiffNetworkDaemon.api.swarm.connect(goId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => goDiffNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(goDiffId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(goId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })

  describe('js private network <-> go public network', () => {
    it('should NOT be able to connect js <-> go', (done) => {
      let jsId
      let goPubId

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => goPublicNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids.shift()
          goPubId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.connect(goPubId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => goPublicNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(goPubId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(jsId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })

  describe('js private network <-> js public network', () => {
    it('should NOT be able to connect js <-> js', (done) => {
      let jsId
      let jsPubId

      series([
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.id(cb),
          (cb) => jsPublicNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          jsId = ids.shift()
          jsPubId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.connect(jsPubId.addresses[0], cb),
          (cb) => jsPublicNetworkDaemon.api.swarm.connect(jsId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => jsPrivateDaemon.api.swarm.peers(cb),
          (cb) => jsPublicNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(jsPubId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(jsId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })

  // This will currently timeout, as go will not error
  describe.skip('go private network <-> go public network', () => {
    it('should NOT be able to connect go <-> go', (done) => {
      let goId
      let goPubId

      series([
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.id(cb),
          (cb) => goPublicNetworkDaemon.api.id(cb)
        ], (err, ids) => {
          expect(err).to.not.exist()
          goId = ids.shift()
          goPubId = ids.shift()
          cb()
        }),
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.swarm.connect(goPubId.addresses[0], cb),
          (cb) => goPublicNetworkDaemon.api.swarm.connect(goId.addresses[0], cb)
        ], cb),
        (cb) => parallel([
          (cb) => goPrivateDaemon.api.swarm.peers(cb),
          (cb) => goPublicNetworkDaemon.api.swarm.peers(cb)
        ], (err, peers) => {
          expect(peers[0].map((p) => p.peer.toB58String())).to.not.include(goPubId.id)
          expect(peers[1].map((p) => p.peer.toB58String())).to.not.include(goId.id)
          cb(err)
        })
      ], () => {
        done()
      })
    })
  })
})
