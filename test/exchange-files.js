/* eslint max-nested-callbacks: ["error", 7] */
/* eslint-env mocha */

import randomBytes from 'iso-random-stream/src/random.js'
import pretty from 'pretty-bytes'
import { nanoid } from 'nanoid'
import isCi from 'is-ci'
import concat from 'it-concat'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import last from 'it-last'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

/**
 * @param {string} dir
 * @param {number} depth
 * @param {number} num
 */
async function * dirContent (dir, depth, num) {
  const dirs = new Array(depth).fill(0).map(() => nanoid())

  for (let i = 0; i < num; i++) {
    const path = `${dir}/${dirs.slice(0, depth).join('/')}/${nanoid()}.txt`

    yield {
      path,
      content: randomBytes(5)
    }
  }
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
const timeout = isCi ? 2 * min : min

describe('exchange files', function () {
  this.timeout(timeout)

  /** @type {Record<string, ('go' | 'js')[]>} */
  const tests = {
    'go -> js': ['go', 'js'],
    'go -> go2': ['go', 'go'],
    'js -> go': ['js', 'go'],
    'js -> js2': ['js', 'js']
  }

  /** @type {Factory} */
  let factory

  before(async () => {
    factory = await daemonFactory()
  })

  Object.keys(tests).forEach((name) => {
    describe(name, () => {
      /** @type {Controller} */
      let daemon1
      /** @type {Controller} */
      let daemon2

      before('spawn nodes', async function () {
        [daemon1, daemon2] = await Promise.all(tests[name].map(type => factory.spawn({ type })))
      })

      before('connect', async function () {
        this.timeout(timeout); // eslint-disable-line

        await daemon1.api.swarm.connect(daemon2.peer.addresses[0])
        await daemon2.api.swarm.connect(daemon1.peer.addresses[0])

        const [peer1, peer2] = await Promise.all([
          daemon1.api.swarm.peers(),
          daemon2.api.swarm.peers()
        ])

        expect(peer1.map((p) => p.peer.toString())).to.include(daemon2.peer.id.toString())
        expect(peer2.map((p) => p.peer.toString())).to.include(daemon1.peer.id.toString())
      })

      after(() => factory.clean())

      describe('cat file', () => sizes.forEach((size) => {
        it(`${name}: ${pretty(size)}`, async function () {
          const data = randomBytes(size)

          const { cid } = await daemon1.api.add(data)
          const file = await concat(daemon2.api.cat(cid))

          expect(file.slice()).to.eql(data)
        })
      }))

      describe('get directory', () => depth.forEach((d) => dirs.forEach((num) => {
        it(`${name}: depth: ${d}, num: ${num}`, async function () {
          const dir = `/${nanoid()}`

          const res = await last(daemon1.api.addAll(dirContent(dir, d, num), {
            wrapWithDirectory: true
          }))

          if (res == null) {
            throw new Error('Nothing added')
          }

          const { cid } = res

          await expect(countFiles(cid, daemon2.api)).to.eventually.equal(num)
        })
      })))
    })
  })
})

/**
 * @param {import('multiformats/cid').CID} cid
 * @param {Controller["api"]} ipfs
 */
async function countFiles (cid, ipfs) {
  let fileCount = 0

  for await (const entry of ipfs.ls(cid)) {
    if (entry.type === 'file') {
      fileCount++
    } else if (entry.type === 'dir') {
      fileCount += await countFiles(entry.cid, ipfs)
    }
  }

  return fileCount
}
