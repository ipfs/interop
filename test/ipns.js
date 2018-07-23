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
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

describe('ipns', () => {
  it('should publish an ipns record to a js daemon and resolve it using the same js daemon', function (done) {
    this.timeout(100 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

    let jsDaemon
    let jsId

    series([
      (cb) => jsDf.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 512 }
      }, (err, node) => {
        expect(err).to.not.exist()
        jsDaemon = node
        jsDaemon.init(cb)
      }),
      (cb) => jsDaemon.start(cb),
      (cb) => jsDaemon.api.id((err, res) => {
        expect(err).to.not.exist()
        jsId = res.id
        cb()
      }),
      (cb) => jsDaemon.api.name.publish(ipfsRef, { resolve: false }, cb),
      (cb) => {
        jsDaemon.api.name.resolve(jsId, (err, res) => {
          expect(err).to.not.exist()
          expect(res).to.equal(ipfsRef)
          cb()
        })
      },
      (cb) => jsDaemon.stop(cb)
      // TODO cleanup repo
    ], done)
  })

  it('should publish an ipns record to a go daemon and resolve it using the same go daemon', function (done) {
    this.timeout(100 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

    let goDaemon1
    let goDaemon2
    let goId1

    parallel([
      (cb) => goDf.spawn({
        repoPath: dir,
        initOptions: { bits: 1024 }
      }, cb),
      (cb) => goDf.spawn({ initOptions: { bits: 1024 } }, cb)
    ], (err, nodes) => {
      expect(err).to.not.exist()

      goDaemon1 = nodes[0]
      goDaemon2 = nodes[1]

      parallel([
        (cb) => goDaemon1.start(cb),
        (cb) => goDaemon2.start(cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()

        series([
          (cb) => goDaemon1.api.id((err, res) => {
            expect(err).to.not.exist()
            goId1 = res
            cb()
          }),
          (cb) => goDaemon1.api.name.publish(ipfsRef, { resolve: false }, cb),
          (cb) => {
            goDaemon1.api.name.resolve(goId1, { resolve: false }, (err, res) => {
              expect(err).to.not.exist()
              expect(res).to.equal(ipfsRef)
              cb()
            })
          },
          (cb) => goDaemon1.stop(cb),
          (cb) => goDaemon2.stop(cb)
          // TODO cleanup repo
          // TODO check need for 2 daemons
        ], done)
      })
    })
  })

  it('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', function (done) {
    this.timeout(1000 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

    let goDaemon1
    let goDaemon2
    let jsDaemon
    let peerId

    series([
      (cb) => jsDf.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 512 }
      }, (err, node) => {
        expect(err).to.not.exist()

        jsDaemon = node
        jsDaemon.init(cb)
      }),
      (cb) => jsDaemon.start(cb),
      (cb) => jsDaemon.api.id((err, res) => {
        expect(err).to.not.exist()
        peerId = res.id

        cb()
      }),
      (cb) => jsDaemon.api.name.publish(ipfsRef, { resolve: false }, cb),
      (cb) => jsDaemon.stop(cb),
      (cb) => setTimeout(cb, 2000),
      (cb) => goDf.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 1024 }
      }, (err, node) => {
        expect(err).to.not.exist()
        goDaemon1 = node
        cb()
      }),
      (cb) => goDf.spawn({ initOptions: { bits: 1024 } }, (err, node) => {
        expect(err).to.not.exist()
        goDaemon2 = node
        cb()
      }),
      (cb) => goDaemon1.start(cb),
      (cb) => goDaemon2.start(cb),
      (cb) => {
        goDaemon1.api.name.resolve(peerId, { resolve: false, local: true }, (err, res) => {
          expect(err).to.not.exist()
          expect(res).to.equal(ipfsRef)
          cb()
        })
      },
      (cb) => goDaemon1.stop(cb),
      (cb) => goDaemon2.stop(cb)
      // TODO cleanup repo
    ], done)
  })

  it('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', function (done) {
    this.timeout(1000 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

    let goDaemon1
    let goDaemon2
    let jsDaemon
    let peerId

    parallel([
      (cb) => goDf.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 1024 }
      }, cb),
      (cb) => goDf.spawn({ initOptions: { bits: 1024 } }, cb)
    ], (err, nodes) => {
      expect(err).to.not.exist()

      goDaemon1 = nodes[0]
      goDaemon2 = nodes[1]

      series([
        (cb) => goDaemon1.init(cb),
        (cb) => goDaemon1.start(cb),
        (cb) => goDaemon2.start(cb),
        (cb) => goDaemon1.api.id((err, res) => {
          expect(err).to.not.exist()

          peerId = res.id
          cb()
        }),
        (cb) => goDaemon1.api.name.publish(ipfsRef, { resolve: false }, cb),
        (cb) => goDaemon1.stop(cb),
        (cb) => goDaemon2.stop(cb),
        (cb) => jsDf.spawn({
          repoPath: dir,
          disposable: false,
          initOptions: { bits: 512 }
        }, (err, node) => {
          expect(err).to.not.exist()

          jsDaemon = node
          cb()
        }),
        (cb) => jsDaemon.start(cb),
        (cb) => {
          jsDaemon.api.name.resolve(peerId, (err, res) => {
            expect(err).to.not.exist()
            expect(res).to.equal(ipfsRef)
            cb()
          })
        },
        (cb) => jsDaemon.stop(cb),
        (cb) => setTimeout(cb, 2000)
        // TODO cleanup repo
      ], done)
    })
  })
})
