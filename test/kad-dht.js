/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const series = require('async/series')
const crypto = require('crypto')
const parallel = require('async/parallel')
const waterfall = require('async/waterfall')
const bl = require('bl')

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create()

describe.skip('kad-dht', () => {
  describe('a JS node in the land of Go', () => {
    let jsD
    let goD1
    let goD2
    let goD3

    before((done) => {
      parallel([
        (cb) => df.spawn({ initOptions: { bits: 1024 } }, cb),
        (cb) => df.spawn({ initOptions: { bits: 1024 } }, cb),
        (cb) => df.spawn({ initOptions: { bits: 1024 } }, cb),
        (cb) => df.spawn({ type: 'js', initOptions: { bits: 512 } }, cb)
      ], (err, nodes) => {
        expect(err).to.not.exist()
        goD1 = nodes[0]
        goD2 = nodes[1]
        goD3 = nodes[2]
        jsD = nodes[3]
        done()
      })
    })

    after((done) => {
      series([
        (cb) => goD1.stop(cb),
        (cb) => goD2.stop(cb),
        (cb) => goD3.stop(cb),
        (cb) => jsD.stop(cb)
      ], done)
    })

    it('make connections', (done) => {
      parallel([
        (cb) => jsD.api.id(cb),
        (cb) => goD1.api.id(cb),
        (cb) => goD2.api.id(cb),
        (cb) => goD3.api.id(cb)
      ], (err, ids) => {
        expect(err).to.not.exist()
        parallel([
          (cb) => jsD.api.swarm.connect(ids[1].addresses[0], cb),
          (cb) => goD1.api.swarm.connect(ids[2].addresses[0], cb),
          (cb) => goD2.api.swarm.connect(ids[3].addresses[0], cb)
        ], done)
      })
    })

    it('one hop', (done) => {
      const data = crypto.randomBytes(9001)

      waterfall([
        (cb) => goD1.api.add(data, cb),
        (res, cb) => jsD.api.cat(res[0].hash, cb),
        (stream, cb) => stream.pipe(bl(cb))
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })

    it('two hops', (done) => {
      const data = crypto.randomBytes(9001)

      waterfall([
        (cb) => goD2.api.add(data, cb),
        (res, cb) => jsD.api.cat(res[0].hash, cb),
        (stream, cb) => stream.pipe(bl(cb))
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })

    it('three hops', (done) => {
      const data = crypto.randomBytes(9001)

      waterfall([
        (cb) => goD3.api.add(data, cb),
        (res, cb) => jsD.api.cat(res[0].hash, cb),
        (stream, cb) => stream.pipe(bl(cb))
      ], (err, file) => {
        expect(err).to.not.exist()
        expect(file).to.be.eql(data)
        done()
      })
    })
  })

  describe('a Go node in the land of JS', () => {})
  describe('hybrid', () => {})
})
