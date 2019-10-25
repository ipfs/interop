/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

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

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

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
const timeout = isCi ? 15 * min : 10 * min

const jsDaemonOptions = {
  config: { Bootstrap: [] }
}

describe('exchange files', function () {
  this.timeout(timeout)

  const tests = {
    'go -> js': [() => spawnGoDaemon(), () => spawnJsDaemon(jsDaemonOptions)],
    'go -> go2': [() => spawnGoDaemon(), () => spawnGoDaemon()],
    'js -> go': [() => spawnJsDaemon(jsDaemonOptions), () => spawnGoDaemon()],
    'js -> js2': [() => spawnJsDaemon(jsDaemonOptions), () => spawnJsDaemon(jsDaemonOptions)]
  }

  Object.keys(tests).forEach((name) => {
    describe(name, () => {
      let daemon1
      let daemon2
      let id1
      let id2

      before('spawn nodes', async function () {
        [daemon1, daemon2] = await Promise.all(tests[name].map(fn => fn()))
      })

      before('connect', async function () {
        this.timeout(timeout); // eslint-disable-line

        [id1, id2] = await Promise.all([
          daemon1.api.id(),
          daemon2.api.id()
        ])

        await daemon1.api.swarm.connect(id2.addresses[0])
        await daemon2.api.swarm.connect(id1.addresses[0])

        const [peer1, peer2] = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peer1.map((p) => p.peer.toB58String())).to.include(id2.id)
        expect(peer2.map((p) => p.peer.toB58String())).to.include(id1.id)
      })

      after('stop nodes', function () {
        return Promise.all([daemon1, daemon2].map((node) => node.stop()))
      })

      describe('cat file', () => sizes.forEach((size) => {
        it(`${name}: ${pretty(size)}`, async function () {
          this.timeout(timeout)

          const data = crypto.randomBytes(size)

          const res = await daemon1.api.add(data)
          const file = await daemon2.api.cat(res[0].hash)

          expect(file).to.eql(data)
        })
      }))

      if (isWindows()) { return }
      // TODO fix dir tests on Windows

      describe('get directory', () => depth.forEach((d) => dirs.forEach((num) => {
        it(`${name}: depth: ${d}, num: ${num}`, async function () {
          this.timeout(timeout)

          const dir = tmpDir()

          await randomFs({
            path: dir,
            depth: d,
            number: num
          })
          const res = await daemon1.api.addFromFs(dir, { recursive: true })
          const hash = res[res.length - 1].hash
          const getRes = await daemon2.api.get(hash)
          expect(getRes).to.exist()

          return rmDir(dir)
        })
      })))
    })
  })
})
