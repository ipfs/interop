/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const crypto = require('crypto')
const UnixFs = require('ipfs-unixfs')
const {
  spawnInitAndStartGoDaemon,
  spawnInitAndStartJsDaemon,
  stopDaemon
} = require('./utils/daemon')
const bufferStream = require('readable-stream-buffer-stream')

const SHARD_THRESHOLD = 1000

class ExpectedError extends Error {

}

function checkNodeTypes (daemon, file) {
  return daemon.api.object.get(file.hash)
    .then(node => {
      const meta = UnixFs.unmarshal(node.Data)

      expect(meta.type).to.equal('file')
      expect(node.Links.length).to.equal(2)

      return Promise.all(
        node.Links.map(link => daemon.api.object.get(link.Hash).then(child => {
          const childMeta = UnixFs.unmarshal(child.Data)

          expect(childMeta.type).to.equal('raw')
        }))
      )
    })
}

function addFile (daemon, data) {
  const fileName = 'test-file'

  return daemon.api.files.write(`/${fileName}`, data, {
    create: true
  })
    // cannot list file directly - https://github.com/ipfs/go-ipfs/issues/5044
    .then(() => {
      return daemon.api.files.ls('/', {
        l: true
      })
    })
    .then(files => {
      return files.filter(file => file.name === fileName).pop()
    })
}

const compare = (...ops) => {
  expect(ops.length).to.be.above(1)

  return Promise.all(
    ops
  )
    .then(results => {
      expect(results.length).to.equal(ops.length)

      const result = results.pop()

      results.forEach(res => expect(res).to.deep.equal(result))
    })
}

const compareErrors = (expectedMessage, ...ops) => {
  expect(ops.length).to.be.above(1)

  return Promise.all(
    // even if operations fail, their errors should be similar
    ops.map(op => op.then(() => {
      throw new ExpectedError('Expected operation to fail')
    }).catch(error => {
      if (error instanceof ExpectedError) {
        throw error
      }

      return {
        message: error.message,
        code: error.code
      }
    }))
  )
    .then(results => {
      expect(results.length).to.equal(ops.length)

      // all implementations should have similar error messages
      results.forEach(res => {
        expect(res.message.toLowerCase()).to.contain(expectedMessage.toLowerCase())
      })

      const result = results.pop()

      // all implementations should have the same error code
      results.forEach(res => {
        expect(res.code).to.equal(result.code)
      })
    })
}

describe('files', function () {
  this.timeout(50 * 1000)

  let go
  let js

  before(() => {
    return Promise.all([
      spawnInitAndStartGoDaemon(),
      spawnInitAndStartJsDaemon()
    ])
      .then(([goDaemon, jsDaemon]) => {
        go = goDaemon
        js = jsDaemon
      })
  })

  after(() => {
    return Promise.all([
      stopDaemon(go),
      stopDaemon(js)
    ])
  })

  it('returns an error when reading non-existent files', () => {
    const readNonExistentFile = (daemon) => {
      return daemon.api.files.read(`/i-do-not-exist-${Math.random()}`)
    }

    return compareErrors(
      'does not exist',
      readNonExistentFile(go),
      readNonExistentFile(js)
    )
  })

  it('returns an error when writing deeply nested files and the parents do not exist', () => {
    const readNonExistentFile = (daemon) => {
      return daemon.api.files.write(`/foo-${Math.random()}/bar-${Math.random()}/baz-${Math.random()}/i-do-not-exist-${Math.random()}`, Buffer.from([0, 1, 2, 3]))
    }

    return compareErrors(
      'does not exist',
      readNonExistentFile(go),
      readNonExistentFile(js)
    )
  })

  it('uses raw nodes for leaf data', () => {
    const data = crypto.randomBytes(1024 * 300)
    const testLeavesAreRaw = (daemon) => {
      return addFile(daemon, data)
        .then(file => checkNodeTypes(daemon, file))
    }

    return compare(
      testLeavesAreRaw(go),
      testLeavesAreRaw(js)
    )
  })

  it('errors when creating the same directory twice', () => {
    const path = `/test-dir-${Math.random()}`

    return compareErrors(
      'already exists',
      go.api.files.mkdir(path).then(() => go.api.files.mkdir(path)),
      js.api.files.mkdir(path).then(() => js.api.files.mkdir(path))
    )
  })

  it('does not error when creating the same directory twice and -p is passed', () => {
    const path = `/test-dir-${Math.random()}`

    return compare(
      go.api.files.mkdir(path).then(() => go.api.files.mkdir(path, { p: true })),
      js.api.files.mkdir(path).then(() => js.api.files.mkdir(path, { p: true }))
    )
  })

  it('errors when creating the root directory', () => {
    const path = '/'

    return compareErrors(
      'already exists',
      go.api.files.mkdir(path).then(() => go.api.files.mkdir(path)),
      js.api.files.mkdir(path).then(() => js.api.files.mkdir(path))
    )
  })

  describe('has the same hashes for', () => {
    const testHashesAreEqual = (daemon, data, options = {}) => {
      return daemon.api.add(data, options)
        .then(files => files[0].hash)
    }

    const _writeData = (daemon, initialData, newData, options) => {
      const fileName = `file-${Math.random()}.txt`

      return daemon.api.files.write(`/${fileName}`, initialData, {
        create: true
      })
        .then(() => daemon.api.files.ls('/', {
          l: true
        }))
        .then(files => files.filter(file => file.name === fileName).pop().hash)
    }

    const appendData = (daemon, initialData, appendedData) => {
      return _writeData(daemon, initialData, appendedData, {
        offset: initialData.length
      })
    }

    const overwriteData = (daemon, initialData, newData) => {
      return _writeData(daemon, initialData, newData, {
        offset: 0
      })
    }

    it('empty files', () => {
      const data = Buffer.alloc(0)

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('small files', () => {
      const data = Buffer.from([0x00, 0x01, 0x02])

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('big files', () => {
      const data = crypto.randomBytes(1024 * 3000)

      return compare(
        testHashesAreEqual(go, data),
        testHashesAreEqual(js, data)
      )
    })

    it('files that have had data appended', () => {
      const initialData = crypto.randomBytes(1024 * 300)
      const appendedData = crypto.randomBytes(1024 * 300)

      return compare(
        appendData(go, initialData, appendedData),
        appendData(js, initialData, appendedData)
      )
    })

    it('files that have had data overwritten', () => {
      const bytes = 1024 * 300
      const initialData = crypto.randomBytes(bytes)
      const newData = crypto.randomBytes(bytes)

      return compare(
        overwriteData(go, initialData, newData),
        overwriteData(js, initialData, newData)
      )
    })

    // requires go-ipfs v0.4.21
    it.skip('small files with CIDv1', () => {
      const data = Buffer.from([0x00, 0x01, 0x02])
      const options = {
        cidVersion: 1
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    // requires go-ipfs v0.4.21
    it.skip('big files with CIDv1', () => {
      const data = crypto.randomBytes(1024 * 3000)
      const options = {
        cidVersion: 1
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('trickle DAGs', () => {
      const chunkSize = 262144
      const buffer = Buffer.alloc(chunkSize, 0)
      const data = bufferStream(chunkSize, {
        generator: (size, callback) => {
          callback(null, buffer.slice(0, size))
        }
      })
      const options = {
        cidVersion: 0,
        trickle: true,
        chunker: 'size-10',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('rabin chunker', () => {
      const chunkSize = 262144
      const buffer = Buffer.alloc(chunkSize, 0)
      const data = bufferStream(chunkSize, {
        generator: (size, callback) => {
          callback(null, buffer.slice(0, size))
        }
      })
      const options = {
        chunker: 'rabin-512-1024-2048',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('rabin chunker small chunks', () => {
      const chunkSize = 262144
      const buffer = Buffer.alloc(chunkSize, 0)
      const data = bufferStream(chunkSize, {
        generator: (size, callback) => {
          callback(null, buffer.slice(0, size))
        }
      })
      const options = {
        chunker: 'rabin-16-16-16',
        pin: false,
        preload: false
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })

    it('hamt shards', () => {
      const data = crypto.randomBytes(100)
      const files = []
      const dir = `/shard-${Date.now()}`

      for (let i = 0; i < SHARD_THRESHOLD + 1; i++) {
        files.push({
          path: `${dir}/file-${i}.txt`,
          content: data
        })
      }

      return compare(
        testHashesAreEqual(go, files),
        testHashesAreEqual(js, files)
      )
    })

    it('updating mfs hamt shards', () => {
      const dir = `/shard-${Date.now()}`
      const data = crypto.randomBytes(100)
      const nodeGrContent = Buffer.from([0, 1, 2, 3, 4])
      const superModuleContent = Buffer.from([5, 6, 7, 8, 9])
      const files = [{
        path: `${dir}/node-gr`,
        content: nodeGrContent
      }, {
        path: `${dir}/yanvoidmodule`,
        content: crypto.randomBytes(5)
      }, {
        path: `${dir}/methodify`,
        content: crypto.randomBytes(5)
      }, {
        path: `${dir}/fis-msprd-style-loader_0_13_1`,
        content: crypto.randomBytes(5)
      }, {
        path: `${dir}/js-form`,
        content: crypto.randomBytes(5)
      }, {
        path: `${dir}/vivanov-sliceart`,
        content: crypto.randomBytes(5)
      }]

      for (let i = 0; i < SHARD_THRESHOLD; i++) {
        files.push({
          path: `${dir}/file-${i}.txt`,
          content: data
        })
      }

      // will operate on sub-shard three levels deep
      const testHamtShardHashesAreEqual = async (daemon, data) => {
        const addedFiles = await daemon.api.add(data)
        const hash = addedFiles[addedFiles.length - 1].hash

        await daemon.api.files.cp(`/ipfs/${hash}`, dir)

        const node = await daemon.api.object.get(hash)
        const meta = UnixFs.unmarshal(node.Data)

        expect(meta.type).to.equal('hamt-sharded-directory')

        await daemon.api.files.write(`${dir}/supermodule_test`, superModuleContent, {
          create: true
        })
        await daemon.api.files.stat(`${dir}/supermodule_test`)
        await daemon.api.files.stat(`${dir}/node-gr`)

        expect(await daemon.api.files.read(`${dir}/node-gr`)).to.deep.equal(nodeGrContent)
        expect(await daemon.api.files.read(`${dir}/supermodule_test`)).to.deep.equal(superModuleContent)

        await daemon.api.files.rm(`${dir}/supermodule_test`)

        try {
          await daemon.api.files.stat(`${dir}/supermodule_test`)
        } catch (err) {
          expect(err.message).to.contain('not exist')
        }

        const stats = await daemon.api.files.stat(dir)
        const nodeAfterUpdates = await daemon.api.object.get(stats.hash)
        const metaAfterUpdates = UnixFs.unmarshal(nodeAfterUpdates.Data)

        expect(metaAfterUpdates.type).to.equal('hamt-sharded-directory')

        return stats.hash
      }

      return compare(
        testHamtShardHashesAreEqual(go, files),
        testHamtShardHashesAreEqual(js, files)
      )
    })
  })
})
