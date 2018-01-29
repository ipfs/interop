/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const crypto = require('crypto')
const os = require('os')
const path = require('path')
const hat = require('hat')

const isWindows = os.platform() === 'win32'

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create()

function catAndCheck (api, hash, data, callback) {
  api.cat(hash, (err, fileData) => {
    expect(err).to.not.exist()
    expect(fileData).to.eql(data)
    callback()
  })
}

describe('repo', () => {
  // skipping until https://github.com/ipfs/interop/issues/8 is addressed
  if (isWindows) {
    return
  }

  it('read repo: go -> js', function (done) {
    this.timeout(50 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    let goDaemon
    let jsDaemon

    let hash
    series([
      (cb) => df.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 1024 }
      }, (err, node) => {
        expect(err).to.not.exist()
        goDaemon = node
        goDaemon.init(cb)
      }),
      (cb) => goDaemon.start(cb),
      (cb) => goDaemon.api.add(data, (err, res) => {
        expect(err).to.not.exist()
        hash = res[0].hash
        cb()
      }),
      (cb) => catAndCheck(goDaemon.api, hash, data, cb),
      (cb) => goDaemon.stop(cb),
      (cb) => df.spawn({
        type: 'js',
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 512 }
      }, (err, node) => {
        expect(err).to.not.exist()
        jsDaemon = node
        cb()
      }),
      (cb) => jsDaemon.start(cb),
      (cb) => catAndCheck(jsDaemon.api, hash, data, cb),
      (cb) => jsDaemon.stop(cb),
      (cb) => setTimeout(cb, 10500),
      (cb) => jsDaemon.cleanup(cb)
    ], done)
  })

  // This was last due to an update on go-ipfs that changed how datastore is
  // configured
  it.skip('read repo: js -> go', function (done) {
    this.timeout(50 * 1000)
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    let jsDaemon
    let goDaemon

    let hash
    series([
      (cb) => df.spawn({
        type: 'js',
        repoPath: dir,
        initOptions: { bits: 512 }
      }, cb),
      (node, cb) => {
        jsDaemon = node
        cb()
      },
      (cb) => jsDaemon.api.add(data, cb),
      (res, cb) => {
        hash = res[0].hash
        catAndCheck(jsDaemon.api, hash, data, cb)
      },
      (cb) => jsDaemon.stop(cb),
      (cb) => df.spawn({
        repoPath: dir,
        initOptions: { bits: 1024 }
      }, cb),
      (node, cb) => {
        goDaemon = node
        cb()
      },
      (cb) => catAndCheck(goDaemon.api, hash, data, cb),
      (cb) => goDaemon.stop(cb)
    ], done)
  })
})
