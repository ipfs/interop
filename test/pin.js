/* eslint-env mocha */
'use strict'

const fs = require('fs')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const DaemonFactory = require('ipfsd-ctl')

const utils = require('./utils/pin-utils')

describe('pin', function () {
  this.timeout(60 * 1000)
  this.slow(30 * 1000)

  const filePath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
  const jupiter = [{
    path: filePath,
    content: fs.readFileSync(filePath)
  }]

  let daemons = []
  function spawnAndStart (type, repoPath = utils.tmpPath()) {
    return new Promise((resolve, reject) => {
      DaemonFactory.create({ type })
        .spawn({
          repoPath,
          disposable: false
        }, (err, daemon) => {
          if (err) return reject(err)
          daemons.push(daemon)

          if (daemon.initialized) {
            // repo already exists, no need to init
            daemon.start(err => err ? reject(err) : resolve(daemon))
          } else {
            daemon.init((err, initRes) => {
              if (err) return reject(err)
              daemon.start(err => err ? reject(err) : resolve(daemon))
            })
          }
        })
    })
  }

  function withDaemons (pipeline) {
    return Promise.all([
      spawnAndStart('go').then(utils.removeAllPins).then(pipeline),
      spawnAndStart('js').then(utils.removeAllPins).then(pipeline)
    ])
  }

  afterEach(function () {
    this.timeout(25 * 1000)
    return utils.stopDaemons(daemons)
      .then(() => { daemons = [] })
  })

  describe('pin add', function () {
    // Pinning a large file recursively results in the same pins
    it('pin recursively', function () {
      function pipeline (daemon) {
        return daemon.api.add(jupiter, { pin: false })
          .then(chunks => daemon.api.pin.add(chunks[0].hash))
          .then(() => daemon.api.pin.ls())
      }

      return withDaemons(pipeline)
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(jsPins).to.deep.include.members(goPins)
          expect(goPins).to.deep.include.members(jsPins)
        })
    })

    // Pinning a large file with recursive=false results in the same direct pin
    it('pin directly', function () {
      function pipeline (daemon) {
        return daemon.api.add(jupiter, { pin: false })
          .then(chunks => daemon.api.pin.add(chunks[0].hash, { recursive: false }))
          .then(() => daemon.api.pin.ls())
      }

      return withDaemons(pipeline)
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(jsPins).to.deep.include.members(goPins)
          expect(goPins).to.deep.include.members(jsPins)
        })
    })
  })

  describe('pin rm', function () {
    // removing a root pin removes children as long as they're
    // not part of another pin's dag
    it('pin recursively, remove the root pin', function () {
      function pipeline (daemon) {
        return daemon.api.add(jupiter)
          .then(chunks => {
            const testFolder = chunks.find(chunk => chunk.path === 'test')
            return daemon.api.pin.rm(testFolder.hash)
          })
          .then(() => daemon.api.pin.ls())
      }

      return withDaemons(pipeline)
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.eql(0)
          expect(jsPins.length).to.eql(0)
        })
    })

    // When a pin contains the root of another pin and we remove it, it is
    // instead kept but its type is changed to 'indirect'
    it('remove a child shared by multiple pins', function () {
      let jupiterDir
      function pipeline (daemon) {
        return daemon.api.add(jupiter, { pin: false })
          .then(chunks => {
            jupiterDir = jupiterDir ||
              chunks.find(chunk => chunk.path === 'test/fixtures/planets')

            // by separately pinning all the DAG nodes created when adding,
            // dirs are pinned as type=recursive and
            // nested pins reference each other
            return daemon.api.pin.add(chunks.map(chunk => chunk.hash))
          })
          .then(() => daemon.api.pin.rm(jupiterDir.hash))
          .then(() => daemon.api.pin.ls())
      }

      return withDaemons(pipeline)
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(goPins).to.deep.include.members(jsPins)
          expect(jsPins).to.deep.include.members(goPins)

          const dirPin = goPins.find(pin => pin.hash === jupiterDir.hash)
          expect(dirPin.type).to.eql('indirect')
        })
    })
  })

  describe('ls', function () {
    it('print same pins', function () {
      function pipeline (daemon) {
        return daemon.api.add(jupiter)
          .then(() => daemon.api.pin.ls())
      }

      return withDaemons(pipeline)
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(goPins).to.deep.include.members(jsPins)
          expect(jsPins).to.deep.include.members(goPins)
        })
    })
  })

  // FIXME: https://github.com/ipfs/js-ipfs/issues/1467
  describe.skip('go and js pinset storage are compatible', function () {
    function pipeline (options) {
      // by starting each daemon with the same repoPath, they
      // will read/write pins from the same datastore.
      const repoPath = utils.tmpPath()
      const content = Buffer.from(String(Math.random()))
      const pins = []

      return spawnAndStart(options.first, repoPath)
        .then(daemon => {
          return daemon.api.add(content)
            .then(() => daemon.api.pin.ls())
        })
        .then(ls => pins.push(ls))
        .then(() => utils.stopDaemons(daemons))
        .then(() => spawnAndStart(options.second, repoPath))
        .then(daemon => daemon.api.pin.ls())
        .then(ls => pins.push(ls))
        .then(() => pins)
    }

    // js-ipfs can read pins stored by go-ipfs
    // tests that go's pin.flush and js' pin.load are compatible
    it('go -> js', function () {
      return pipeline({ first: 'go', second: 'js' })
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(jsPins).to.deep.include.members(goPins)
          expect(goPins).to.deep.include.members(jsPins)
        })
    })

    // go-ipfs can read pins stored by js-ipfs
    // tests that js' pin.flush and go's pin.load are compatible
    it.skip('js -> go', function () {
      // skipped because go can not be spawned on a js repo due to changes in
      // the DataStore config [link]
      return pipeline({ first: 'js', second: 'go' })
        .then(([jsPins, goPins]) => {
          expect(jsPins.length).to.be.gt(0)
          expect(goPins).to.deep.include.members(jsPins)
          expect(jsPins).to.deep.include.members(goPins)
        })
    })
  })
})
