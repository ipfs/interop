/* eslint-env mocha */

import randomBytes from 'iso-random-stream/src/random.js'
import { UnixFS } from 'ipfs-unixfs'
import { daemonFactory } from './utils/daemon-factory.js'
import concat from 'it-concat'
import all from 'it-all'
import last from 'it-last'
import { expect } from 'aegir/chai'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

const SHARD_THRESHOLD = 1000

class ExpectedError extends Error {

}

const goOptions = {
  ipfsOptions: {
    config: {
      // enabled sharding for go with automatic threshold dropped to the minimum
      Internal: {
        UnixFSShardingSizeThreshold: '1B'
      }
    }
  }
}

const jsOptions = {
  // enabled sharding for js
  args: ['--enable-sharding-experiment']
}

/**
 * @param {Controller} daemon
 * @param {string} path
 * @param {Parameters<Controller["api"]["files"]["mkdir"]>[1]} [options]
 */
const createDirectory = (daemon, path, options) => {
  return daemon.api.files.mkdir(path, options)
}

/**
 * @param {Controller} daemon
 * @param {Awaited<ReturnType<Controller["api"]["add"]>>} [file]
 */
async function checkNodeTypes (daemon, file) {
  if (file == null) {
    throw new Error('No file specified')
  }

  const node = await daemon.api.object.get(file.cid)

  if (node.Data == null) {
    throw new Error('No data found on pb node')
  }

  const meta = UnixFS.unmarshal(node.Data)

  expect(meta.type).to.equal('file')
  expect(node.Links.length).to.equal(2)

  return Promise.all(
    node.Links.map(async (link) => {
      const child = await daemon.api.object.get(link.Hash)

      if (child.Data == null) {
        throw new Error('No data found on pb node')
      }

      const childMeta = UnixFS.unmarshal(child.Data)

      expect(childMeta.type).to.equal('raw')
    })
  )
}

/**
 * @param {Controller} daemon
 * @param {Uint8Array} data
 */
async function addFile (daemon, data) {
  const fileName = 'test-file'

  await daemon.api.files.write(`/${fileName}`, data, { create: true })
  const files = await all(daemon.api.files.ls('/'))

  return files.filter(file => file.name === fileName).pop()
}

function createDataStream (size = 262144) {
  const chunkSize = 4096
  const buffer = new Uint8Array(chunkSize)

  return (async function * () {
    for (let i = 0; i < size; i += chunkSize) {
      yield buffer.subarray(0, size)
    }
  }())
}

/**
 * @param {...any} ops
 */
const compare = async (...ops) => {
  expect(ops).to.have.property('length').that.is.above(1)

  const results = await Promise.all(ops)

  expect(results).to.have.lengthOf(ops.length)

  const result = results.pop()

  results.forEach(res => expect(res).to.deep.equal(result))
}

/**
 * @param {string} expectedMessage
 * @param {...any} ops
 */
const compareErrors = async (expectedMessage, ...ops) => {
  expect(ops).to.have.property('length').that.is.above(1)

  const results = await Promise.all(
    ops.map(async (op) => {
      try {
        await op
        throw new ExpectedError('Expected operation to fail')
      } catch (/** @type {any} */ error) {
        if (error instanceof ExpectedError) {
          throw error
        }

        return {
          message: error.message,
          code: error.code
        }
      }
    }))

  expect(results).to.have.lengthOf(ops.length)

  // all implementations should have similar error messages
  results.forEach(res => {
    expect(res.message.toLowerCase()).to.contain(expectedMessage.toLowerCase())
  })

  const result = results.pop()

  if (result == null) {
    throw new Error('No result found')
  }

  // all implementations should have the same error code
  results.forEach(res => {
    expect(res).to.have.property('code', result.code)
  })
}

describe('files', function () {
  this.timeout(500 * 1000)

  /** @type {Controller} */
  let go
  /** @type {Controller} */
  let js
  /** @type {Factory} */
  let factory

  before(async () => {
    factory = await daemonFactory();

    [go, js] = await Promise.all([
      factory.spawn({
        type: 'go',
        ...goOptions
      }),
      factory.spawn({
        type: 'js',
        ...jsOptions
      })
    ])
  })

  after(() => factory.clean())

  it('returns an error when reading non-existent files', () => {
    /**
     * @param {Controller} daemon
     */
    const readNonExistentFile = (daemon) => {
      return concat(daemon.api.files.read(`/i-do-not-exist-${Math.random()}`))
    }

    return compareErrors(
      'does not exist',
      readNonExistentFile(go),
      readNonExistentFile(js)
    )
  })

  it('returns an error when writing deeply nested files and the parents do not exist', () => {
    /**
     * @param {Controller} daemon
     */
    const writeNonExistentFile = (daemon) => {
      return daemon.api.files.write(`/foo-${Math.random()}/bar-${Math.random()}/baz-${Math.random()}/i-do-not-exist-${Math.random()}`, Uint8Array.from([0, 1, 2, 3]))
    }

    return compareErrors(
      'does not exist',
      writeNonExistentFile(go),
      writeNonExistentFile(js)
    )
  })

  // FIXME: ky clones response and causes high water mark to be hit for large responses
  // https://github.com/sindresorhus/ky/blob/bb46ca86e36d8998c0425ac1fa3b3faf9972c82b/index.js#L299
  // Similar to the problem we worked around here:
  // https://github.com/ipfs/js-ipfs-http-client/blob/d7eb0e8ffb15e207a8a6062e292a3b5babf35a9e/src/lib/error-handler.js#L12-L23
  it.skip('uses raw nodes for leaf data', () => {
    const data = randomBytes(1024 * 300)
    /**
     * @param {Controller} daemon
     */
    const testLeavesAreRaw = async (daemon) => {
      const file = await addFile(daemon, data)
      // @ts-expect-error types do not have sufficient overlap
      await checkNodeTypes(daemon, file)
    }

    return compare(
      testLeavesAreRaw(go),
      testLeavesAreRaw(js)
    )
  })

  it('errors when creating the same directory twice', () => {
    const path = `/test-dir-${Math.random()}`
    /**
     * @param {Controller} daemon
     */
    const createSameDirectory = async (daemon) => {
      await createDirectory(daemon, path)
      await createDirectory(daemon, path)
    }

    return compareErrors(
      'already exists',
      createSameDirectory(go),
      createSameDirectory(js)
    )
  })

  it('does not error when creating the same directory twice and parents option is passed', () => {
    const path = `/test-dir-${Math.random()}`
    /**
     * @param {Controller} daemon
     */
    const createSameDirectory = async (daemon) => {
      await createDirectory(daemon, path)
      await createDirectory(daemon, path, { parents: true })
    }

    return compare(
      createSameDirectory(go),
      createSameDirectory(js)
    )
  })

  it('errors when creating the root directory', () => {
    const path = '/'
    /**
     * @param {Controller} daemon
     */
    const createSameDirectory = async (daemon) => {
      await createDirectory(daemon, path)
      await createDirectory(daemon, path)
    }

    return compareErrors(
      'already exists',
      createSameDirectory(go),
      createSameDirectory(js)
    )
  })

  describe('has the same hashes for', () => {
    /**
     * @param {Controller} daemon
     * @param {Parameters<Controller["api"]["add"]>[0]} data
     * @param {Parameters<Controller["api"]["add"]>[1]} options
     */
    const testHashesAreEqual = async (daemon, data, options = {}) => {
      const { cid } = await daemon.api.add(data, options)

      return cid
    }

    /**
     * @param {Controller} daemon
     * @param {Parameters<Controller["api"]["addAll"]>[0]} data
     * @param {Parameters<Controller["api"]["addAll"]>[1]} options
     */
    const testDirectoryHashesAreEqual = async (daemon, data, options = {}) => {
      const res = await last(daemon.api.addAll(data, options))

      if (res == null) {
        throw new Error('Nothing added')
      }

      const { cid } = res

      return cid
    }

    /**
     * @param {Controller} daemon
     * @param {Parameters<Controller["api"]["files"]["write"]>[1]} initialData
     * @param {Parameters<Controller["api"]["files"]["write"]>[1]} newData
     * @param {Parameters<Controller["api"]["files"]["write"]>[2]} options
     */
    const _writeData = async (daemon, initialData, newData, options = {}) => {
      const fileName = `file-${Math.random()}.txt`

      await daemon.api.files.write(`/${fileName}`, initialData, { create: true, ...options })
      const files = await all(daemon.api.files.ls('/'))
      const needle = files.filter(file => file.name === fileName).pop()

      if (needle == null) {
        throw new Error('Nothing written')
      }

      return needle.cid
    }

    /**
     * @param {Controller} daemon
     * @param {Uint8Array} initialData
     * @param {Parameters<Controller["api"]["files"]["write"]>[1]} appendedData
     */
    const appendData = (daemon, initialData, appendedData) => {
      return _writeData(daemon, initialData, appendedData, {
        offset: initialData.length
      })
    }

    /**
     * @param {Controller} daemon
     * @param {Parameters<Controller["api"]["files"]["write"]>[1]} initialData
     * @param {Parameters<Controller["api"]["files"]["write"]>[1]} newData
     */
    const overwriteData = (daemon, initialData, newData) => {
      return _writeData(daemon, initialData, newData, {
        offset: 0
      })
    }

    it('empty files', () => {
      const data = new Uint8Array(0)

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('small files', () => {
      const data = Uint8Array.from([0x00, 0x01, 0x02])

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('big files', () => {
      const data = randomBytes(1024 * 3000)

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('files that have had data appended', () => {
      const initialData = randomBytes(1024 * 300)
      const appendedData = randomBytes(1024 * 300)

      return compare(
        appendData(go, initialData, appendedData),
        appendData(js, initialData, appendedData)
      )
    })

    it('files that have had data overwritten', () => {
      const bytes = 1024 * 300
      const initialData = randomBytes(bytes)
      const newData = randomBytes(bytes)

      return compare(
        overwriteData(go, initialData, newData),
        overwriteData(js, initialData, newData)
      )
    })

    it('small files with CIDv1', () => {
      const data = Uint8Array.from([0x00, 0x01, 0x02])
      /** @type {Parameters<Controller["api"]["add"]>[1]} */
      const options = {
        cidVersion: 1
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('big files with CIDv1', () => {
      const data = randomBytes(1024 * 3000)
      /** @type {Parameters<Controller["api"]["add"]>[1]} */
      const options = {
        cidVersion: 1
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('trickle DAGs', () => {
      /** @type {Parameters<Controller["api"]["add"]>[1]} */
      const options = {
        cidVersion: 0,
        trickle: true,
        chunker: 'size-10',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, createDataStream(10000), options),
        testHashesAreEqual(js, createDataStream(10000), options)
      )
    })

    it('rabin chunker', () => {
      const options = {
        chunker: 'rabin-512-1024-2048',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, createDataStream(), options),
        testHashesAreEqual(js, createDataStream(), options)
      )
    })

    it('rabin chunker small chunks', () => {
      const options = {
        chunker: 'rabin-16-32-64',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, createDataStream(), options),
        testHashesAreEqual(js, createDataStream(), options)
      )
    })

    it('hamt shards', () => {
      const data = randomBytes(100)
      const files = []
      const dir = `/shard-${Date.now()}`

      for (let i = 0; i < SHARD_THRESHOLD + 1; i++) {
        files.push({
          path: `${dir}/file-${i}.txt`,
          content: data
        })
      }

      return compare(
        testDirectoryHashesAreEqual(go, files),
        testDirectoryHashesAreEqual(js, files)
      )
    })

    it('updating mfs hamt shards', () => {
      const dir = `/shard-${Date.now()}`
      const data = randomBytes(100)
      const nodeGrContent = Uint8Array.from([0, 1, 2, 3, 4])
      const superModuleContent = Uint8Array.from([5, 6, 7, 8, 9])
      const files = [{
        path: `${dir}/node-gr`,
        content: nodeGrContent
      }, {
        path: `${dir}/yanvoidmodule`,
        content: randomBytes(5)
      }, {
        path: `${dir}/methodify`,
        content: randomBytes(5)
      }, {
        path: `${dir}/fis-msprd-style-loader_0_13_1`,
        content: randomBytes(5)
      }, {
        path: `${dir}/js-form`,
        content: randomBytes(5)
      }, {
        path: `${dir}/vivanov-sliceart`,
        content: randomBytes(5)
      }]

      for (let i = 0; i < SHARD_THRESHOLD; i++) {
        files.push({
          path: `${dir}/file-${i}.txt`,
          content: data
        })
      }

      /**
       * will operate on sub-shard three levels deep
       *
       * @param {Controller} daemon
       * @param {Parameters<Controller["api"]["addAll"]>[0]} data
       */
      const testHamtShardHashesAreEqual = async (daemon, data) => {
        const res = await last(daemon.api.addAll(data))

        if (res == null) {
          throw new Error('Nothing added')
        }

        const { cid } = res

        await daemon.api.files.cp(`/ipfs/${cid}`, dir)

        const node = await daemon.api.object.get(cid)

        if (node.Data == null) {
          throw new Error('No data found on pb node')
        }

        const meta = UnixFS.unmarshal(node.Data)

        expect(meta.type).to.equal('hamt-sharded-directory')

        await daemon.api.files.write(`${dir}/supermodule_test`, superModuleContent, {
          create: true
        })
        await daemon.api.files.stat(`${dir}/supermodule_test`)
        await daemon.api.files.stat(`${dir}/node-gr`)

        expect((await concat(daemon.api.files.read(`${dir}/node-gr`))).slice())
          .to.deep.equal(nodeGrContent)
        expect((await concat(daemon.api.files.read(`${dir}/supermodule_test`))).slice())
          .to.deep.equal(superModuleContent)

        await daemon.api.files.rm(`${dir}/supermodule_test`)

        await expect(daemon.api.files.stat(`${dir}/supermodule_test`))
          .to.eventually.be.rejectedWith(/not exist/)

        const stats = await daemon.api.files.stat(dir)
        const nodeAfterUpdates = await daemon.api.object.get(stats.cid)

        if (nodeAfterUpdates.Data == null) {
          throw new Error('No data found on pb node')
        }

        const metaAfterUpdates = UnixFS.unmarshal(nodeAfterUpdates.Data)

        expect(metaAfterUpdates.type).to.equal('hamt-sharded-directory')

        return stats.cid
      }

      return compare(
        testHamtShardHashesAreEqual(go, files),
        testHamtShardHashesAreEqual(js, files)
      )
    })
  })
})
