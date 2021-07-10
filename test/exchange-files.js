/* eslint max-nested-callbacks: ["error", 7] */
/* eslint-env mocha */
'use strict'

const randomBytes = require('iso-random-stream/src/random')
const pretty = require('pretty-bytes')
const randomFs = require('random-fs')
const promisify = require('promisify-es6')
const rimraf = require('rimraf')
const join = require('path').join
const { nanoid } = require('nanoid')
const isCi = require('is-ci')
const isWindows = require('is-os').isWindows
const os = require('os')
const rmDir = promisify(rimraf)
const concat = require('it-concat')
const { globSource } = require(process.env.IPFS_JS_MODULE || 'ipfs')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')

function tmpDir () {
  return join(os.tmpdir(), `ipfs_${nanoid()}`)
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

describe('exchange files', function () {
  this.timeout(timeout)

  const tests = {
    'go -> js': ['go', 'js'],
    'go -> go2': ['go', 'go'],
    'js -> go': ['js', 'go'],
    'js -> js2': ['js', 'js']
  }

  Object.keys(tests).forEach((name) => {
    describe(name, () => {
      let daemon1
      let daemon2

      before('spawn nodes', async function () {
        [daemon1, daemon2] = await Promise.all(tests[name].map(type => daemonFactory.spawn({ type })))
      })

      before('connect', async function () {
        this.timeout(timeout); // eslint-disable-line

        await daemon1.api.swarm.connect(daemon2.api.peerId.addresses[0])
        await daemon2.api.swarm.connect(daemon1.api.peerId.addresses[0])

        const [peer1, peer2] = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peer1.map((p) => p.peer.toString())).to.include(daemon2.api.peerId.id)
        expect(peer2.map((p) => p.peer.toString())).to.include(daemon1.api.peerId.id)
      })

      after(() => daemonFactory.clean())

      describe('cat file', () => sizes.forEach((size) => {
        it(`${name}: ${pretty(size)}`, async function () {
          this.timeout(timeout)

          const data = randomBytes(size)

          const { cid } = await daemon1.api.add(data)
          const file = await concat(daemon2.api.cat(cid))

          expect(file.slice()).to.eql(data)
        })
      }))

      if (isWindows()) { return }
      // TODO fix dir tests on Windows

      describe('get directory', () => depth.forEach((d) => dirs.forEach((num) => {
        it(`${name}: depth: ${d}, num: ${num}`, async function () {
          this.timeout(timeout)

          const dir = tmpDir()

          try {
            await randomFs({
              path: dir,
              depth: d,
              number: num
            })
            const { cid } = await daemon1.api.add(globSource(dir, { recursive: true }))

            let fileCount = 0
            for await (const file of daemon2.api.get(cid)) {
              if (file.content) {
                fileCount++
                await concat(file.content)
              }
            }
            expect(fileCount).to.equal(num)
          } finally {
            await rmDir(dir)
          }
        })
      })))
    })
  })
})
