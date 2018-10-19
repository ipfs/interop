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

class ExpectedError extends Error {

}

function checkNodeTypes (daemon, file) {
  return daemon.api.object.get(file.hash)
    .then(node => {
      const meta = UnixFs.unmarshal(node.data)

      expect(meta.type).to.equal('file')
      expect(node.links.length).to.equal(2)

      return Promise.all(
        node.links.map(link => daemon.api.object.get(link.toJSON().multihash).then(child => {
          const childMeta = UnixFs.unmarshal(child.data)

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

const compareErrors = (...ops) => {
  expect(ops.length).to.be.above(1)

  return Promise.all(
    // even if operations fail, their errors should be the same
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

      const result = results.pop()

      results.forEach(res => expect(res).to.deep.equal(result))
    })
}

// TODO: remove after https://github.com/crypto-browserify/randombytes/pull/16 released
const MAX_BYTES = 65536
function randomBytes (num) {
  if (num < 1) return Buffer.alloc(0)
  if (num <= MAX_BYTES) return crypto.randomBytes(num)

  const chunks = Array(Math.floor(num / MAX_BYTES))
    .fill(MAX_BYTES)
    .concat(num % MAX_BYTES)
    .map(n => crypto.randomBytes(n))

  return Buffer.concat(chunks)
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
      readNonExistentFile(go),
      readNonExistentFile(js)
    )
  })

  it('returns an error when writing deeply nested files and the parents do not exist', () => {
    const readNonExistentFile = (daemon) => {
      return daemon.api.files.write(`/foo-${Math.random()}/bar-${Math.random()}/baz-${Math.random()}/i-do-not-exist-${Math.random()}`, Buffer.from([0, 1, 2, 3]))
    }

    return compareErrors(
      readNonExistentFile(go),
      readNonExistentFile(js)
    )
  })

  it('uses raw nodes for leaf data', () => {
    const data = randomBytes(1024 * 300)
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
      go.api.files.mkdir(path).then(() => go.api.files.mkdir(path)),
      js.api.files.mkdir(path).then(() => js.api.files.mkdir(path))
    )
  })

  describe('has the same hashes for', () => {
    const testHashesAreEqual = (daemon, data, options) => {
      return daemon.api.files.add(data, options)
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
      const data = Buffer.from([0x00, 0x01, 0x02])
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
      const options = {
        cidVersion: 1
      }

      return compare(
        testHashesAreEqual(go, data, options),
        testHashesAreEqual(js, data, options)
      )
    })
  })
})
