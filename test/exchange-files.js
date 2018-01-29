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
const pretty = require('pretty-bytes')
const randomFs = require('random-fs')
const promisify = require('promisify-es6')
const rimraf = require('rimraf')
const join = require('path').join
const os = require('os')
const hat = require('hat')

const isWindows = os.platform() === 'win32'

const rmDir = promisify(rimraf)

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create()

function tmpDir () {
  return join(os.tmpdir(), `ipfs_${hat()}`)
}

const sizes = [
  1024,
  1024 * 62,
  // starts failing with spdy
  1024 * 64,
  1024 * 512,
  1024 * 768,
  1024 * 1023,
  1024 * 1024,
  1024 * 1024 * 4,
  1024 * 1024 * 8
]

const dirs = [
  5,
  10,
  50,
  100
]

describe('exchange files', () => {
  let goDaemon
  let jsDaemon
  let js2Daemon

  let nodes

  before(function (done) {
    this.timeout(50 * 1000)

    parallel([
      (cb) => df.spawn({ initOptions: { bits: 1024 } }, cb),
      (cb) => df.spawn({ type: 'js', initOptions: { bits: 512 } }, cb),
      (cb) => df.spawn({ type: 'js', initOptions: { bits: 512 } }, cb)
    ], (err, n) => {
      expect(err).to.not.exist()
      nodes = n
      goDaemon = nodes[0]
      jsDaemon = nodes[1]
      js2Daemon = nodes[2]
      done()
    })
  })

  after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

  it('connect go <-> js', function (done) {
    this.timeout(50 * 1000)

    let jsId
    let goId

    series([
      (cb) => parallel([
        (cb) => jsDaemon.api.id(cb),
        (cb) => goDaemon.api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        jsId = ids[0]
        goId = ids[1]
        cb()
      }),
      (cb) => goDaemon.api.swarm.connect(jsId.addresses[0], cb),
      (cb) => jsDaemon.api.swarm.connect(goId.addresses[0], cb),
      (cb) => parallel([
        (cb) => goDaemon.api.swarm.peers(cb),
        (cb) => jsDaemon.api.swarm.peers(cb)
      ], (err, peers) => {
        expect(err).to.not.exist()
        expect(peers[0].map((p) => p.peer.toB58String())).to.include(jsId.id)
        expect(peers[1].map((p) => p.peer.toB58String())).to.include(goId.id)
        cb()
      })
    ], done)
  })

  it('connect js <-> js', function (done) {
    this.timeout(50 * 1000)

    let jsId
    let js2Id

    series([
      (cb) => parallel([
        (cb) => jsDaemon.api.id(cb),
        (cb) => js2Daemon.api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        jsId = ids[0]
        js2Id = ids[1]
        cb()
      }),
      (cb) => js2Daemon.api.swarm.connect(jsId.addresses[0], cb),
      (cb) => jsDaemon.api.swarm.connect(js2Id.addresses[0], cb),
      (cb) => parallel([
        (cb) => js2Daemon.api.swarm.peers(cb),
        (cb) => jsDaemon.api.swarm.peers(cb)
      ], (err, peers) => {
        expect(err).to.not.exist()
        expect(peers[0].map((p) => p.peer.toB58String())).to.include(jsId.id)
        expect(peers[1].map((p) => p.peer.toB58String())).to.include(js2Id.id)
        cb()
      })
    ], done)
  })

  describe('cat file', () => sizes.forEach((size) => {
    it(`go -> js: ${pretty(size)}`, function (done) {
      this.timeout(50 * 1000)
      const data = crypto.randomBytes(size)
      waterfall([
        (cb) => goDaemon.api.add(data, cb),
        (res, cb) => jsDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })

    it(`js -> go: ${pretty(size)}`, function (done) {
      this.timeout(50 * 1000)
      const data = crypto.randomBytes(size)
      waterfall([
        (cb) => jsDaemon.api.add(data, cb),
        (res, cb) => goDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })

    it(`js -> js: ${pretty(size)}`, function (done) {
      this.timeout(20 * 1000)
      const data = crypto.randomBytes(size)
      waterfall([
        (cb) => js2Daemon.api.add(data, cb),
        (res, cb) => jsDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })
  }))

  // TODO these tests are not fetching the full dir??
  describe('get directory', () => dirs.forEach((num) => {
    // skipping until https://github.com/ipfs/interop/issues/9 is addressed
    if (isWindows) {
      return
    }

    it(`go -> js: depth: 5, num: ${num}`, function () {
      this.timeout(50 * 1000)
      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: 5,
        number: num
      }).then(() => {
        return goDaemon.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return jsDaemon.api.object.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })

    it(`js -> go: depth: 5, num: ${num}`, function () {
      this.timeout(50 * 1000)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: 5,
        number: num
      }).then(() => {
        return jsDaemon.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return goDaemon.api.object.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })

    it(`js -> js: depth: 5, num: ${num}`, function () {
      this.timeout(80 * 1000)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: 5,
        number: num
      }).then(() => {
        return js2Daemon.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return jsDaemon.api.object.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })
  }))
})
