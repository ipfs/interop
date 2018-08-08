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
      initOptions: { bits: 1024 },
      args: ['--offline']
    }, callback)
}

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

const publishAndResolve = (publisherDaemon, resolverDaemon, callback) => {
  let nodeId
  let sameDaemon = false

  if (typeof resolverDaemon === 'function') {
    callback = resolverDaemon
    resolverDaemon = publisherDaemon
    sameDaemon = true
  }

  const stopAndStartSecondDaemon = (callback) => {
    if (sameDaemon) {
      return callback()
    }
    series([
      (cb) => publisherDaemon.stop(cb),
      (cb) => setTimeout(cb, 2000),
      (cb) => resolverDaemon.start(cb)
    ], callback)
  }

  series([
    (cb) => publisherDaemon.init(cb),
    (cb) => publisherDaemon.start(cb),
    (cb) => publisherDaemon.api.id((err, res) => {
      expect(err).to.not.exist()
      nodeId = res.id
      cb()
    }),
    (cb) => publisherDaemon.api.name.publish(ipfsRef, { resolve: false }, cb),
    (cb) => stopAndStartSecondDaemon(cb),
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

describe('ipns', () => {
  it('should publish an ipns record to a js daemon and resolve it using the same js daemon', function (done) {
    this.timeout(100 * 1000)
    const dir = path.join(os.tmpdir(), hat())

    spawnJsDaemon(dir, (err, jsDaemon) => {
      expect(err).to.not.exist()
      publishAndResolve(jsDaemon, done)
    })
  })

  it('should publish an ipns record to a go daemon and resolve it using the same go daemon', function (done) {
    this.timeout(120 * 1000)
    const dir = path.join(os.tmpdir(), hat())

    spawnGoDaemon(dir, (err, goDaemon) => {
      expect(err).to.not.exist()
      publishAndResolve(goDaemon, done)
    })
  })

  it('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', function (done) {
    this.timeout(100 * 1000)
    const dir = path.join(os.tmpdir(), hat())

    parallel([
      (cb) => spawnJsDaemon(dir, cb),
      (cb) => spawnGoDaemon(dir, cb)
    ], (err, daemons) => {
      expect(err).to.not.exist()

      publishAndResolve(daemons[0], daemons[1], done)
    })
  })

  it('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', function (done) {
    this.timeout(120 * 1000)
    const dir = path.join(os.tmpdir(), hat())

    parallel([
      (cb) => spawnGoDaemon(dir, cb),
      (cb) => spawnJsDaemon(dir, cb)
    ], (err, daemons) => {
      expect(err).to.not.exist()

      publishAndResolve(daemons[0], daemons[1], done)
    })
  })
})
