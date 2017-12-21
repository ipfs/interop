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

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create()

function catAndCheck (api, hash, data, callback) {
  api.cat(hash, (err, fileData) => {
    expect(err).to.not.exist()
    expect(fileData).to.eql(data)
    callback()
  })
}

describe.skip('repo', () => {
  it.skip('read repo: go -> js', function (done) {
    this.timeout(50 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    let goDaemon
    let jsDaemon

    let hash
    waterfall([
      (cb) => df.spawn({
        repoPath: dir,
        disposable: false,
        initOptions: { bits: 1024 }
      }, (err, node) => {
        expect(err).to.not.exist()
        goDaemon = node
        goDaemon.api.add(data, cb)
      },
      (res, cb) => {
        hash = res[0].hash
        catAndCheck(goDaemon.api, hash, data, cb)
      },
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
      },
      (cb) => catAndCheck(jsDaemon.api, hash, data, cb),
      (cb) => jsDaemon.stop(cb)
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
