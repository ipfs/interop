/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const waterfall = require('async/waterfall')
const crypto = require('crypto')
const os = require('os')
const path = require('path')
const hat = require('hat')
const UnixFs = require('ipfs-unixfs')

const DaemonFactory = require('ipfsd-ctl')
const goDf = DaemonFactory.create()
const jsDf = DaemonFactory.create({ type: 'js' })

function checkNodeTypes (api, hash, data, callback) {
  waterfall([
    (cb) => api.object.get(hash, cb),
    (node, cb) => {
      const meta = UnixFs.unmarshal(node.data)

      expect(meta.type).to.equal('file')
      expect(node.links.length).to.equal(2)

      api.object.get(node.links[0].multihash, cb)
    },
    (child, cb) => {
      const childMeta = UnixFs.unmarshal(child.data)

      expect(childMeta.type).to.equal('raw')

      cb()
    }
  ], callback)
}

function addFile (daemon, dir, data, callback) {
  let instance
  const path = 'test-file'

  waterfall([
    (cb) => daemon.spawn({
      repoPath: dir,
      disposable: false,
      initOptions: { bits: 1024 }
    }, cb),
    (node, cb) => {
      instance = node
      instance.init(cb)
    },
    (cb) => instance.start((error) => cb(error)),
    (cb) => {
      instance.api.files.write(`/${path}`, data, {
        create: true
      }, (error) => cb(error))
    },
    // cannot list file directly - https://github.com/ipfs/go-ipfs/issues/5044
    (cb) => instance.api.files.ls(`/`, {
      l: true
    }, cb),
    (files, cb) => checkNodeTypes(instance.api, files[0].hash, data, cb),
    (cb) => instance.stop(cb)
  ], callback)
}

describe('mfs', () => {
  it('mfs uses raw nodes for leaf data: go', function (done) {
    this.timeout(50 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 300)

    addFile(goDf, dir, data, done)
  })

  it('mfs uses raw nodes for leaf data: js', function (done) {
    this.timeout(50 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 300)

    addFile(jsDf, dir, data, done)
  })
})
