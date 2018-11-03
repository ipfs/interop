/* eslint max-nested-callbacks: ["error", 6] */
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
const hat = require('hat')
const isCi = require('is-ci')
const isWindows = require('is-os').isWindows
const os = require('os')

const rmDir = promisify(rimraf)

const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

function tmpDir () {
  return join(os.tmpdir(), `ipfs_${hat()}`)
}

const KB = 1024
const MB = KB * 1024
// const GB = MB * 1024

const sizes = [
  KB,
  62 * KB,
  // starts failing with spdy
  64 * KB,
  512 * KB,
  768 * KB,
  1023 * KB,
  MB,
  4 * MB,
  8 * MB,
  64 * MB,
  128 * MB
  // 512 * MB
  // GB
  // 10 * GB,
  // 100 * GB,
  // 1000 * GB
]

if (isCi) {
  sizes.push(
    // 512 * MB,
    // GB
    // 10 * GB,
    // 100 * GB,
    // 1000 * GB
  )
}

const dirs = [
  5,
  10
  // 50,
  // 100,
  // 1000,
  // 10000
]

if (isCi) {
  dirs.push(
    // 50,
    // 100,
    // 1000
    // 10000
  )
}

const depth = [
  5,
  10
]

if (isCi) {
  depth.push(
    // 100
    // 1000
    // 10000
  )
}

const min = 60 * 1000
const timeout = isCi ? 15 * min : 5 * min

describe('exchange files', () => {
  let goDaemon
  let goDaemon2
  let jsDaemon
  let jsDaemon2

  let nodes

  before(function (done) {
    this.timeout(timeout)

    parallel([
      (cb) => goDf.spawn({ initOptions: { bits: 1024 } }, cb),
      (cb) => goDf.spawn({ initOptions: { bits: 1024 } }, cb),
      (cb) => jsDf.spawn({ type: 'js', initOptions: { bits: 512 } }, cb),
      (cb) => jsDf.spawn({ type: 'js', initOptions: { bits: 512 } }, cb)
    ], (err, n) => {
      expect(err).to.not.exist()
      nodes = n
      goDaemon = nodes[0]
      goDaemon2 = nodes[1]
      jsDaemon = nodes[2]
      jsDaemon2 = nodes[3]
      done()
    })
  })

  after(function (done) {
    this.timeout(timeout)

    parallel(nodes.map((node) => (cb) => node.stop(cb)), done)
  })

  it('connect go <-> js', function (done) {
    this.timeout(timeout)

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

  it('connect go <-> go2', function (done) {
    this.timeout(timeout)

    let goId
    let go2Id

    series([
      (cb) => parallel([
        (cb) => goDaemon.api.id(cb),
        (cb) => goDaemon2.api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        goId = ids[0]
        go2Id = ids[1]
        cb()
      }),
      (cb) => goDaemon.api.swarm.connect(go2Id.addresses[0], cb),
      (cb) => goDaemon2.api.swarm.connect(goId.addresses[0], cb),
      (cb) => parallel([
        (cb) => goDaemon.api.swarm.peers(cb),
        (cb) => goDaemon2.api.swarm.peers(cb)
      ], (err, peers) => {
        expect(err).to.not.exist()
        expect(peers[0].map((p) => p.peer.toB58String())).to.include(go2Id.id)
        expect(peers[1].map((p) => p.peer.toB58String())).to.include(goId.id)
        cb()
      })
    ], done)
  })

  it('connect js <-> js2', function (done) {
    this.timeout(timeout)

    let jsId
    let js2Id

    series([
      (cb) => parallel([
        (cb) => jsDaemon.api.id(cb),
        (cb) => jsDaemon2.api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        jsId = ids[0]
        js2Id = ids[1]
        cb()
      }),
      (cb) => jsDaemon2.api.swarm.connect(jsId.addresses[0], cb),
      (cb) => jsDaemon.api.swarm.connect(js2Id.addresses[0], cb),
      (cb) => parallel([
        (cb) => jsDaemon2.api.swarm.peers(cb),
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
      this.timeout(timeout)

      const data = crypto.randomBytes(size)

      waterfall([
        (cb) => goDaemon.api.add(data, cb),
        (res, cb) => jsDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.eql(data)
        done()
      })
    })

    it(`js -> go: ${pretty(size)}`, function (done) {
      this.timeout(timeout)

      const data = crypto.randomBytes(size)

      waterfall([
        (cb) => jsDaemon.api.add(data, cb),
        (res, cb) => goDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.eql(data)
        done()
      })
    })

    it(`js -> js2: ${pretty(size)}`, function (done) {
      this.timeout(timeout)

      const data = crypto.randomBytes(size)

      waterfall([
        (cb) => jsDaemon2.api.add(data, cb),
        (res, cb) => jsDaemon.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.eql(data)
        done()
      })
    })

    it(`go -> go2: ${pretty(size)}`, function (done) {
      this.timeout(timeout)

      const data = crypto.randomBytes(size)

      waterfall([
        (cb) => goDaemon.api.add(data, cb),
        (res, cb) => goDaemon2.api.cat(res[0].hash, cb)
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.eql(data)
        done()
      })
    })
  }))

  if (isWindows) { return }
  // TODO fix dir tests on Windows

  describe('get directory', () => depth.forEach((d) => dirs.forEach((num) => {
    it(`go -> js: depth: ${d}, num: ${num}`, function () {
      this.timeout(timeout)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: d,
        number: num
      }).then(() => {
        return goDaemon.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return jsDaemon.api.files.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })

    it(`js -> go: depth: ${d}, num: ${num}`, function () {
      this.timeout(timeout)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: d,
        number: num
      }).then(() => {
        return jsDaemon.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return goDaemon.api.files.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })

    it(`js -> js2: depth: ${d}, num: ${num}`, function () {
      this.timeout(timeout)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: d,
        number: num
      }).then(() => {
        return jsDaemon2.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return jsDaemon.api.files.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })

    it(`go -> go2: depth: ${d}, num: ${num}`, function () {
      this.timeout(timeout)

      const dir = tmpDir()
      return randomFs({
        path: dir,
        depth: d,
        number: num
      }).then(() => {
        return goDaemon2.api.util.addFromFs(dir, { recursive: true })
      }).then((res) => {
        const hash = res[res.length - 1].hash
        return goDaemon.api.files.get(hash)
      }).then((res) => {
        expect(res).to.exist()
        return rmDir(dir)
      })
    })
  })))
})
