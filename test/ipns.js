/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const parallel = require('async/parallel')
const os = require('os')
const path = require('path')
const hat = require('hat')

const DaemonFactory = require('ipfsd-ctl')

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

describe.only('ipns', () => {
  describe('ipns locally using the same repo across implementations', () => {
    const spawnJsDaemon = (dir, callback) => {
      DaemonFactory.create({ type: 'js' })
        .spawn({
          repoPath: dir,
          disposable: false,
          initOptions: { bits: 512 }
        }, callback)
    }

    const spawnGoDaemon = (dir, callback) => {
      DaemonFactory.create()
        .spawn({
          repoPath: dir,
          disposable: false,
          initOptions: { bits: 1024 }
        }, callback)
    }

    const publishAndResolve = (publisherDaemon, resolverDaemon, callback) => {
      let nodeId
      let sameDaemon = false

      if (typeof resolverDaemon === 'function') {
        callback = resolverDaemon
        resolverDaemon = publisherDaemon
        sameDaemon = true
      }

      const stopPublisherAndStartResolverDaemon = (callback) => {
        series([
          (cb) => publisherDaemon.stop(cb),
          (cb) => setTimeout(cb, 2000),
          (cb) => resolverDaemon.start(['--offline'], cb)
        ], callback)
      }

      series([
        (cb) => publisherDaemon.init(cb),
        (cb) => publisherDaemon.start(['--offline'], cb),
        (cb) => publisherDaemon.api.id((err, res) => {
          expect(err).to.not.exist()
          nodeId = res.id
          cb()
        }),
        (cb) => publisherDaemon.api.name.publish(ipfsRef, { resolve: false, 'allow-offline': true }, cb),
        (cb) => sameDaemon ? cb() : stopPublisherAndStartResolverDaemon(cb),
        (cb) => {
          resolverDaemon.api.name.resolve(nodeId, { local: true }, (err, res) => {
            expect(err).to.not.exist()
            expect(res).to.equal(ipfsRef)
            cb()
          })
        },
        (cb) => resolverDaemon.stop(cb),
        (cb) => setTimeout(cb, 2000),
        (cb) => resolverDaemon.cleanup(cb)
      ], callback)
    }

    it('should publish an ipns record to a js daemon and resolve it using the same js daemon', function (done) {
      this.timeout(120 * 1000)
      const dir = path.join(os.tmpdir(), hat())

      spawnJsDaemon(dir, (err, jsDaemon) => {
        expect(err).to.not.exist()
        publishAndResolve(jsDaemon, done)
      })
    })

    it('should publish an ipns record to a go daemon and resolve it using the same go daemon', function (done) {
      this.timeout(160 * 1000)
      const dir = path.join(os.tmpdir(), hat())

      spawnGoDaemon(dir, (err, goDaemon) => {
        expect(err).to.not.exist()
        publishAndResolve(goDaemon, done)
      })
    })

    it('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', function (done) {
      this.timeout(120 * 1000)
      const dir = path.join(os.tmpdir(), hat())

      series([
        (cb) => spawnJsDaemon(dir, cb),
        (cb) => spawnGoDaemon(dir, cb)
      ], (err, daemons) => {
        expect(err).to.not.exist()

        publishAndResolve(daemons[0], daemons[1], done)
      })
    })

    it('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', function (done) {
      this.timeout(160 * 1000)
      const dir = path.join(os.tmpdir(), hat())

      series([
        (cb) => spawnGoDaemon(dir, cb),
        (cb) => spawnJsDaemon(dir, cb)
      ], (err, daemons) => {
        expect(err).to.not.exist()

        publishAndResolve(daemons[0], daemons[1], done)
      })
    })
  })

  describe('ipns over dht', () => {
    const spawnJsDaemon = (callback) => {
      DaemonFactory.create({ type: 'js' })
        .spawn({
          disposable: true,
          initOptions: { bits: 512 },
          args: ['--enable-dht-experiment'], // enable dht
          config: { Bootstrap: [] }
        }, callback)
    }

    const spawnGoDaemon = (callback) => {
      DaemonFactory.create()
        .spawn({
          disposable: true,
          initOptions: { bits: 1024 },
          config: { Bootstrap: [] }
        }, callback)
    }

    let nodeAId
    let nodeBId
    let nodes = []

    // Spawn daemons
    before(function (done) {
      // CI takes longer to instantiate the daemon, so we need to increase the timeout
      this.timeout(80 * 1000)
      series([
        (cb) => spawnGoDaemon(cb),
        (cb) => spawnJsDaemon(cb),
        (cb) => spawnGoDaemon(cb)
      ], (err, daemons) => {
        expect(err).to.not.exist()
        nodes = daemons
        done()
      })
    })

    // Get node ids
    before(function (done) {
      this.timeout(100 * 1000)
      parallel([
        (cb) => nodes[0].api.id(cb),
        (cb) => nodes[1].api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        expect(ids).to.exist()
        expect(ids[0].id).to.exist()
        expect(ids[1].id).to.exist()
        nodeAId = ids[0]
        nodeBId = ids[1]
        parallel([
          (cb) => nodes[2].api.swarm.connect(ids[0].addresses[0], cb), // C => A
          (cb) => nodes[2].api.swarm.connect(ids[1].addresses[0], cb) // C => B
        ], done)
      })
    })

    after(function (done) {
      this.timeout(60 * 1000)
      parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
    })

    it('should publish the record to a go node and resolve it using a js node', function (done) {
      this.timeout(50 * 1000)
      series([
        (cb) => nodes[0].api.name.publish(ipfsRef, { resolve: false }, cb),
        (cb) => nodes[1].api.name.resolve(nodeAId.id, cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.exist()
        expect(res[0].value).to.equal(ipfsRef)
        expect(res[0].name).to.equal(nodeAId.id)
        expect(res[1]).to.equal(ipfsRef)
        done()
      })
    })

    it('should publish the record to a js node and resolve it using a go node', function (done) {
      this.timeout(50 * 1000)
      series([
        (cb) => nodes[1].api.name.publish(ipfsRef, { resolve: false }, cb),
        (cb) => nodes[0].api.name.resolve(nodeBId.id, cb)
      ], (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.exist()
        expect(res[0].value).to.equal(ipfsRef)
        expect(res[0].name).to.equal(nodeBId.id)
        expect(res[1]).to.equal(ipfsRef)
        done()
      })
    })
  })
})
