/* eslint-env mocha */
'use strict'

const os = require('os')
const fs = require('fs')
const path = require('path')
const chai = require('chai')
const hat = require('hat')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const series = require('async/series')
const waterfall = require('async/waterfall')
const parallel = require('async/parallel')

const DaemonFactory = require('ipfsd-ctl')

describe('pin', function () {
  this.timeout(5 * 1000)

  const daemons = {}

  function spawnAndStart(type, repoPath, cb) {
    setTimeout(() =>
      DaemonFactory.create({ type: type }).spawn({
        repoPath,
        disposable: false,
      }, (err, daemon) => {
        expect(err).to.not.exist()
        daemons[type] = daemon

        if (daemon.initialized) {
          // repo already exists, no need to init
          daemon.start(err => cb(err, daemon))
        } else {
          daemon.init((err, initRes) => {
            err && console.log('daemon.init error:', err)
            expect(err).to.not.exist()
            daemon.start(err => cb(err, daemon))
          })
        }
      }), 1000)
  }

  before(function (done) {
    this.timeout(50 * 1000)
    // DaemonFactory.create({ type: 'js' }).spawn({ disposable: false, repoPath: jsRepoPath}, cb)
    done()
  })

  afterEach(function (done) {
    this.timeout(25 * 1000)
    stopDaemons(daemons, done)
  })

  describe(`go and js understand each other's stored pins`, () => {
    // js-ipfs can read pins stored by go-ipfs
    // tests that go's pin.flush and js' pin.load are compatible
    it('go -> js', function (done) {
      // DONE?
      this.timeout(20 * 1000)
      this.slow(15000)
      const repoPath = genRepoPath()
      const content = String(Math.random() + Date.now())
      let contentHash
      let goPins
      let jsPins
      series([
        cb => spawnAndStart('go', repoPath, cb),
        cb => daemons.go.api.add(Buffer.from(content), (err, hash) => {
          contentHash = hash[0].hash
          cb(err)
        }),
        cb => daemons.go.api.pin.ls((err, res) => {
          goPins = res
          cb(err)
        }),
        cb => daemons.go.stop(cb),
        cb => spawnAndStart('js', repoPath, cb),
        cb => daemons.js.api.pin.ls((err, res) => {
          jsPins = res
          cb(err)
        }),
      ], errs => {
        expect(errs).to.not.exist()
        expect(goPins.length > 0).to.eql(true)
        expect(jsPins).to.deep.include.members(goPins)
        expect(goPins).to.deep.include.members(jsPins)
        // expect(goPins).to.deep.eql(jsPins) // fails due to ordering
      })
    })

    // go-ipfs can read pins stored by js-ipfs
    // tests that js' pin.flush and go's pin.load are compatible
    it.skip('js -> go', function (done) {
      // skipped because go can not be spawned on a js repo due to changes in DataStore [link]
      this.timeout(20 * 1000)
      this.slow(15000)
      const repoPath = genRepoPath()
      const content = String(Math.random() + Date.now())
      let contentHash
      let jsPins
      let goPins
      series([
        cb => spawnAndStart('js', repoPath, cb),
        cb =>
          daemons.js.api.add(Buffer.from(content), (err, hash) => {
            contentHash = hash[0].hash
            cb(err)
          }),
        cb =>
          daemons.js.api.pin.ls((err, res) => {
            jsPins = res
            cb(err)
          }),
        cb => daemons.js.stop(cb),
        cb => spawnAndStart('go', repoPath, cb),
        cb =>
          daemons.go.api.pin.ls((err, res) => {
            goPins = res
            cb(err)
          }),
      ], errs => {
        expect(errs).to.not.exist()
        expect(jsPins.length > 0).to.eql(true)
        expect(jsPins).to.deep.eql(goPins)
      })
    })
  })

  // tests that each daemon pins larger files in the same chunks
  it('create the same indirect pins', function (done) {
    // DONE
    this.timeout(30 * 1000)
    this.slow(30 * 1000)

    const contentPath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
    const content = [{
      path: contentPath,
      content: fs.readFileSync(contentPath),
    }]

    parallel([
      cb =>
        spawnAndStart('go', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => Promise.all(
              chunks.map(chunk => daemon.api.pin.add(chunk.hash))
            ))
            .then(() => daemon.api.pin.ls())
            .then(goPins => cb(null, goPins))
        }),
      cb =>
        spawnAndStart('js', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => Promise.all(
              chunks.map(chunk => daemon.api.pin.add(chunk.hash))
            ))
            .then(pinAddRes => daemon.api.pin.ls())
            .then(jsPins => cb(null, jsPins))
        }),
    ], (errs, [goPins, jsPins]) => {
      expect(errs).to.not.exist()
      expect(jsPins).to.deep.include.members(goPins)
      expect(goPins).to.deep.include.members(jsPins)
      // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
    })
  })

  // Pinning a large file with recursive=false results in the same direct pins
  it('pin directly', function (done) {
    // DONE
    this.timeout(30 * 1000)

    const contentPath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
    const content = [{
      path: contentPath,
      content: fs.readFileSync(contentPath),
    }]

    parallel([
      cb =>
        spawnAndStart('go', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => Promise.all(
              chunks.map(
                chunk => daemon.api.pin.add(chunk.hash, { recursive: false })
              )
            ))
            .then(() => daemon.api.pin.ls())
            .then(goPins => cb(null, goPins))
        }),
      cb =>
        spawnAndStart('js', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => Promise.all(
              chunks.map(
                chunk => daemon.api.pin.add(chunk.hash, { recursive: false })
              )
            ))
            .then(pinAddRes => daemon.api.pin.ls())
            .then(jsPins => cb(null, jsPins))
        }),
    ], (errs, [goPins, jsPins]) => {
      expect(errs).to.not.exist()
      expect(jsPins).to.deep.include.members(goPins)
      expect(goPins).to.deep.include.members(jsPins)
      // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
    })
  })

  // removing root pin removes children not part of another pinset
  it('pin recursively, remove the root pin', function (done) {
    // DONE
    this.timeout(20 * 1000)
    this.slow(20 * 1000)

    const contentPath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
    const content = [{
      path: contentPath,
      content: fs.readFileSync(contentPath),
    }]

    parallel([
      cb =>
        spawnAndStart('go', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content))
            .then(chunks => {
              const testFolder = chunks.find(chunk => chunk.path === 'test').hash
              return daemon.api.pin.rm(testFolder)
            })
            .then(() => daemon.api.pin.ls())
            .then(goPins => cb(null, goPins))
            .catch(cb)
        }),
      cb =>
        spawnAndStart('js', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content))
            .then(chunks => {
              const testFolder = chunks.find(chunk => chunk.path === 'test').hash
              return daemon.api.pin.rm(testFolder)
            })
            .then(() => daemon.api.pin.ls())
            .then(jsPins => cb(null, jsPins))
            .catch(cb)
        }),
    ], (errs, [goPins, jsPins]) => {
      expect(errs).to.not.exist()
      expect(goPins.length).to.eql(0)
      expect(jsPins.length).to.eql(0)
      // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
    })
  })

  // When a pin contains the root pin of another and we remove it, it is
  // instead kept but its type is changed to 'indirect'
  it('remove a child shared by multiple pins', function (done) {
    this.timeout(20 * 1000)
    this.slow(20 * 1000)

    const contentPath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
    const content = [{
      path: contentPath,
      content: fs.readFileSync(contentPath),
    }]
    let planetsFolder

    parallel([
      cb =>
        spawnAndStart('go', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => {
              planetsFolder = planetsFolder ||
                chunks.find(chunk => chunk.path === 'test/fixtures/planets').hash
              return daemon.api.pin.add(chunks.map(chunk => chunk.hash))
                .then(() => daemon.api.pin.rm(planetsFolder))
            })
            .then(() => daemon.api.pin.ls())
            .then(goPins => cb(null, goPins))
            .catch(cb)
        }),
      cb =>
        spawnAndStart('js', genRepoPath(), (err, daemon) => {
          removeAllPins(daemon)
            .then(() => daemon.api.add(content, { pin: false }))
            .then(chunks => {
              planetsFolder = planetsFolder ||
                chunks.find(chunk => chunk.path === 'test/fixtures/planets').hash
              return daemon.api.pin.add(chunks.map(chunk => chunk.hash))
                .then(() => daemon.api.pin.rm(planetsFolder))
            })
            .then(() => daemon.api.pin.ls())
            .then(jsPins => cb(null, jsPins))
            .catch(cb)
        }),
    ], (errs, [goPins, jsPins]) => {
      expect(errs).to.not.exist()
      expect(goPins).to.deep.include.members(jsPins)
      expect(jsPins).to.deep.include.members(goPins)
      expect(goPins.find(pin => planetsFolder).type).to.eql('indirect')
      // expect(jsPins).to.deep.eql(goPins) // fails due to ordering
      done()
    })
  })
})

function removeAllPins(daemon) {
  return daemon.api.pin.ls().then(pins => {
    const rootPins = pins.filter(
      pin => pin.type === 'recursive' || pin.type === 'direct'
    )
    return Promise.all(rootPins.map(pin => daemon.api.pin.rm(pin.hash)))
  })
}

function stopDaemons (daemons, callback) {
  parallel(
    Object.values(daemons).map(daemon => cb => daemon.stop(cb)),
    callback
  )
}

function genRepoPath () {
  return path.join(os.tmpdir(), hat())
}
