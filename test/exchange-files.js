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

const { spawnInitAndStartGoDaemon, spawnInitAndStartJsDaemon } = require('./utils/daemon')

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
const timeout = isCi ? 8 * min : 5 * min

const jsDaemonOptions = {
  initOptions: { bits: 512 },
  config: { Bootstrap: [] }
}

describe('exchange files', () => {
  const tests = {
    'go -> js': [() => spawnInitAndStartGoDaemon(), () => spawnInitAndStartJsDaemon(jsDaemonOptions)],
    'go -> go2': [() => spawnInitAndStartGoDaemon(), () => spawnInitAndStartGoDaemon()],
    'js -> go': [() => spawnInitAndStartJsDaemon(jsDaemonOptions), () => spawnInitAndStartGoDaemon()],
    'js -> js2': [() => spawnInitAndStartJsDaemon(jsDaemonOptions), () => spawnInitAndStartJsDaemon(jsDaemonOptions)]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, () => {
      let daemon1
      let daemon2
      let id1
      let id2

      before('spawn nodes', async function () {
        this.timeout(timeout)

        const nodes = await Promise.all(tests[name].map(fn => fn()))
        daemon1 = nodes[0]
        daemon2 = nodes[1]
      })

      before('connect', function (done) {
        this.timeout(timeout)

        series([
          (cb) => parallel([
            (cb) => daemon1.api.id(cb),
            (cb) => daemon2.api.id(cb)
          ], (err, ids) => {
            expect(err).to.not.exist()
            id1 = ids[0]
            id2 = ids[1]
            cb()
          }),
          (cb) => daemon1.api.swarm.connect(id2.addresses[0], cb),
          (cb) => daemon2.api.swarm.connect(id1.addresses[0], cb),
          (cb) => parallel([
            (cb) => daemon1.api.swarm.peers(cb),
            (cb) => daemon2.api.swarm.peers(cb)
          ], (err, peers) => {
            expect(err).to.not.exist()
            expect(peers[0].map((p) => p.peer.toB58String())).to.include(id2.id)
            expect(peers[1].map((p) => p.peer.toB58String())).to.include(id1.id)
            cb()
          })
        ], done)
      })

      after('stop nodes', function () {
        this.timeout(timeout)

        return Promise.all([daemon1, daemon2].map((node) => node.stop()))
      })

      describe('cat file', () => sizes.forEach((size) => {
        it(`${name}: ${pretty(size)}`, function (done) {
          this.timeout(timeout)

          const data = crypto.randomBytes(size)

          waterfall([
            (cb) => daemon1.api.add(data, cb),
            (res, cb) => daemon2.api.cat(res[0].hash, cb)
          ], (err, file) => {
            expect(err).to.not.exist()
            expect(file).to.eql(data)
            done()
          })
        })
      }))

      if (isWindows()) { return }
      // TODO fix dir tests on Windows

      describe('get directory', () => depth.forEach((d) => dirs.forEach((num) => {
        it(`${name}: depth: ${d}, num: ${num}`, function () {
          this.timeout(timeout)

          const dir = tmpDir()
          return randomFs({
            path: dir,
            depth: d,
            number: num
          }).then(() => {
            return daemon1.api.addFromFs(dir, { recursive: true })
          }).then((res) => {
            const hash = res[res.length - 1].hash
            return daemon2.api.get(hash)
          }).then((res) => {
            expect(res).to.exist()
            return rmDir(dir)
          })
        })
      })))
    })
  })
})
