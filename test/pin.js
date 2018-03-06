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
  this.timeout(5 * 1000)

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

  afterEach(function () {
    this.timeout(25 * 1000)
    return utils.stopDaemons(daemons)
      .then(() => { daemons = [] })
  })

  // tests that each daemon pins large files in the same chunks
  it('create the same indirect pins', function () {
    this.timeout(30 * 1000)
    this.slow(30 * 1000)

    function pipeline (daemon) {
      return utils.removeAllPins(daemon)
        .then(() => daemon.api.add(jupiter, { pin: false }))
        .then(chunks => Promise.all(
          chunks.map(chunk => daemon.api.pin.add(chunk.hash))
        ))
        .then(() => daemon.api.pin.ls())
    }

    return Promise.all([
      spawnAndStart('go').then(pipeline),
      spawnAndStart('js').then(pipeline)
    ])
      .then(([goPins, jsPins]) => {
        expect(goPins.length).to.be.gt(0)
        expect(jsPins).to.deep.include.members(goPins)
        expect(goPins).to.deep.include.members(jsPins)
        // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
      })
  })

  // Pinning a large file with recursive=false results in the same direct pins
  it('pin directly', function () {
    this.timeout(30 * 1000)

    function pipeline (daemon) {
      return utils.removeAllPins(daemon)
        .then(() => daemon.api.add(jupiter, { pin: false }))
        .then(chunks => Promise.all(
          chunks.map(
            chunk => daemon.api.pin.add(chunk.hash, { recursive: false })
          )
        ))
        .then(() => daemon.api.pin.ls())
    }

    return Promise.all([
      spawnAndStart('go').then(pipeline),
      spawnAndStart('js').then(pipeline)
    ])
      .then(([goPins, jsPins]) => {
        expect(goPins.length).to.be.gt(0)
        expect(jsPins).to.deep.include.members(goPins)
        expect(goPins).to.deep.include.members(jsPins)
        // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
      })
  })

  // removing a root pin removes children as long as they're
  // not part of another pin's dag
  it('pin recursively, remove the root pin', function () {
    this.timeout(20 * 1000)
    this.slow(20 * 1000)

    function pipeline (daemon) {
      return utils.removeAllPins(daemon)
        .then(() => daemon.api.add(jupiter))
        .then(chunks => {
          const testFolder = chunks.find(chunk => chunk.path === 'test').hash
          return daemon.api.pin.rm(testFolder)
        })
        .then(() => daemon.api.pin.ls())
    }

    return Promise.all([
      spawnAndStart('go').then(pipeline),
      spawnAndStart('js').then(pipeline)
    ])
      .then(([goPins, jsPins]) => {
        expect(goPins.length).to.eql(0)
        expect(jsPins.length).to.eql(0)
      })
  })

  // When a pin contains the root pin of another and we remove it, it is
  // instead kept but its type is changed to 'indirect'
  it('remove a child shared by multiple pins', function () {
    this.timeout(20 * 1000)
    this.slow(20 * 1000)

    let jupiterDir
    function pipeline (daemon) {
      return utils.removeAllPins(daemon)
        .then(() => daemon.api.add(jupiter, { pin: false }))
        .then(chunks => {
          jupiterDir = jupiterDir ||
            chunks.find(chunk => chunk.path === 'test/fixtures/planets')
          return daemon.api.pin.add(chunks.map(chunk => chunk.hash))
        })
        .then(() => daemon.api.pin.rm(jupiterDir.hash))
        .then(() => daemon.api.pin.ls())
    }

    return Promise.all([
      spawnAndStart('go').then(pipeline),
      spawnAndStart('js').then(pipeline)
    ])
      .then(([goPins, jsPins]) => {
        expect(goPins).to.deep.include.members(jsPins)
        expect(jsPins).to.deep.include.members(goPins)

        const dirPin = goPins.find(pin => pin.hash === jupiterDir.hash)
        expect(dirPin.type).to.eql('indirect')
        // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
      })
  })

  describe(`go and js pinset storage are compatible`, () => {
    function pipeline (daemonType) {
      // by starting each daemon with the same repoPath, they will read/write
      // pins from the same datestore.
      const repoPath = utils.tmpPath()
      const content = Buffer.from(String(Math.random()))
      const nextType = daemonType === 'go' ? 'js' : 'go'
      const pins = []

      return spawnAndStart(daemonType, repoPath)
        .then(daemon => {
          return daemon.api.add(content)
            .then(() => daemon.api.pin.ls())
        })
        .then(ls => pins.push(ls))
        .then(() => utils.stopDaemons(daemons))
        .then(() => spawnAndStart(nextType, repoPath))
        .then(daemon => daemon.api.pin.ls())
        .then(ls => pins.push(ls))
        .then(() => pins)
    }

    // js-ipfs can read pins stored by go-ipfs
    // tests that go's pin.flush and js' pin.load are compatible
    it('go -> js', function () {
      this.timeout(20 * 1000)
      this.slow(15000)

      return pipeline('go')
        .then(([goPins, jsPins]) => {
          expect(goPins.length).to.be.gt(0)
          expect(jsPins).to.deep.include.members(goPins)
          expect(goPins).to.deep.include.members(jsPins)
          // expect(goPins).to.deep.eql(jsPins) // fails due to ordering
        })
    })

    // go-ipfs can read pins stored by js-ipfs
    // tests that js' pin.flush and go's pin.load are compatible
    it.skip('js -> go', function () {
      // skipped because go can not be spawned on a js repo due to changes in
      // the DataStore config [link]
      this.timeout(20 * 1000)
      this.slow(15000)

      return pipeline('js')
        .then(([jsPins, goPins]) => {
          expect(jsPins.length).to.be.gt(0)
          expect(goPins).to.deep.include.members(jsPins)
          expect(jsPins).to.deep.include.members(goPins)
          // expect(goPins).to.deep.eql(jsPins) // fails due to ordering
        })
    })
  })
})
