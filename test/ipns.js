/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const os = require('os')
const path = require('path')
const hat = require('hat')

const DaemonFactory = require('ipfsd-ctl')
const {
  spawnInitAndStartGoDaemon,
  config,
  stopDaemon
} = require('./utils/daemon')

const spawnJsDaemon = (dir, callback) => {
  DaemonFactory.create({ type: 'js' })
    .spawn({
      repoPath: dir,
      disposable: false,
      initOptions: { bits: 512 },
      args: ['--offline'],
      config
    }, callback)
}

const spawnGoDaemon = (dir, callback) => {
  DaemonFactory.create()
    .spawn({
      repoPath: dir,
      disposable: false,
      initOptions: { bits: 1024 },
      args: ['--offline'],
      config
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

  const stopPublisherAndStartResolverDaemon = (callback) => {
    series([
      (cb) => publisherDaemon.stop(cb),
      (cb) => setTimeout(cb, 2000),
      (cb) => resolverDaemon.start(cb)
    ], callback)
  }

  series([
    (cb) => publisherDaemon.init(cb),
    (cb) => publisherDaemon.start(cb),
    // Go needs to have at least 1 peer before performing an ipns publish,
    // so lets connect for the publish
    (cb) => publisherDaemon.api.swarm.connect(goStaticNodeId.addresses[0], cb),
    (cb) => publisherDaemon.api.id((err, res) => {
      expect(err).to.not.exist()
      nodeId = res.id
      cb()
    }),
    (cb) => publisherDaemon.api.name.publish(ipfsRef, { resolve: false }, cb),
    // disconnect from the static node before we attempt to resolve
    (cb) => publisherDaemon.api.swarm.disconnect(goStaticNodeId.addresses[0], cb),
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

let goStaticNode
let goStaticNodeId

describe('ipns locally using the same repo across implementations', () => {
  before(function () {
    return spawnInitAndStartGoDaemon()
      .then((node) => {
        goStaticNode = node
        return new Promise((resolve, reject) => {
          goStaticNode.api.id((err, id) => {
            if (err) return reject

            goStaticNodeId = id
            resolve()
          })
        })
      })
  })
  after(function () {
    return stopDaemon(goStaticNode)
  })

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
