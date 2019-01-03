/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const parallel = require('async/parallel')

const DaemonFactory = require('ipfsd-ctl')

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

const spawnJsDaemon = (callback) => {
  DaemonFactory.create({ type: 'js' })
    .spawn({
      disposable: true,
      initOptions: { bits: 512 },
      config: { Bootstrap: [] },
      libp2p: {
        config: {
          dht: {
            enabled: true
          }
        }
      }
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

describe('ipns over dht', () => {
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
