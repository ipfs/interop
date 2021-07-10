/* eslint-env mocha */
'use strict'

const fs = require('fs')
const all = require('it-all')
const utils = require('./utils/pin-utils')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')
const uint8ArrayFromString = require('uint8arrays/from-string')

describe('pin', function () {
  this.timeout(60 * 1000)
  this.slow(30 * 1000)

  const filePath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
  const jupiter = [{
    path: filePath,
    content: fs.readFileSync(filePath)
  }]

  let daemons = []
  async function spawnAndStart (type, repoPath = utils.tmpPath()) {
    const daemonOptions = {
      ipfsOptions: {
        repo: repoPath
      },
      disposable: false
    }

    const daemon = await daemonFactory.spawn({
      ...daemonOptions,
      type
    })
    daemons.push(daemon)

    if (daemon.initialized) {
      // repo already exists, no need to init
      await daemon.start()
    } else {
      await daemon.init()
      await daemon.start()
    }

    return daemon
  }

  async function withDaemons (pipeline) {
    const goDaemon = await spawnAndStart('go')
    await utils.removeAllPins(goDaemon)

    const jsDaemon = await spawnAndStart('js')
    await utils.removeAllPins(jsDaemon)

    return Promise.all([pipeline(goDaemon), pipeline(jsDaemon)])
  }

  afterEach(async function () {
    this.timeout(25 * 1000)
    await daemonFactory.clean()
    daemons = []
  })

  describe('pin add', function () {
    // Pinning a large file recursively results in the same pins
    it('pin recursively', async function () {
      async function pipeline (daemon) {
        const { cid } = await daemon.api.add(jupiter, { pin: false })
        await daemon.api.pin.add(cid)

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins).to.have.property('length').that.is.gt(0)
      expect(jsPins).to.deep.include.members(goPins)
      expect(goPins).to.deep.include.members(jsPins)
    })

    // Pinning a large file with recursive=false results in the same direct pin
    it('pin directly', async function () {
      async function pipeline (daemon) {
        const { cid } = await daemon.api.add(jupiter, { pin: false })
        await daemon.api.pin.add(cid, { recursive: false })

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins).to.have.property('length').that.is.gt(0)
      expect(jsPins).to.deep.include.members(goPins)
      expect(goPins).to.deep.include.members(jsPins)
    })
  })

  describe('pin rm', function () {
    // removing a root pin removes children as long as they're
    // not part of another pin's dag
    it('pin recursively, remove the root pin', async function () {
      async function pipeline (daemon) {
        const { cid } = await daemon.api.add(jupiter)
        await daemon.api.pin.rm(cid)

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins.length).to.eql(0)
      expect(jsPins.length).to.eql(0)
    })

    // When a pin contains the root of another pin and we remove it, it is
    // instead kept but its type is changed to 'indirect'
    it('remove a child shared by multiple pins', async function () {
      let jupiterDir
      async function pipeline (daemon) {
        const { cid } = await daemon.api.add(jupiter, { pin: false, wrapWithDirectory: true })
        jupiterDir = jupiterDir || await daemon.api.files.stat(`/ipfs/${cid}/test/fixtures/planets`)

        // by separately pinning all the DAG nodes created when adding,
        // dirs are pinned as type=recursive and
        // nested pins reference each other
        let fullPath = ''
        await Promise.all(
          filePath.split('/').map(path => {
            fullPath = `${fullPath}/${path}`

            return daemon.api.files.stat(`/ipfs/${cid}${fullPath}`)
              .then(result => daemon.api.pin.add(result.cid)) // eslint-disable-line max-nested-callbacks
          })
        )
        await daemon.api.pin.rm(jupiterDir.cid)

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins).to.have.property('length').that.is.gt(0)
      expect(goPins).to.deep.include.members(jsPins)
      expect(jsPins).to.deep.include.members(goPins)

      const dirPin = goPins.find(pin => pin.cid.equals(jupiterDir.cid))
      expect(dirPin.type).to.eql('indirect')
    })
  })

  describe('ls', function () {
    it('print same pins', async function () {
      async function pipeline (daemon) {
        await daemon.api.add(jupiter)

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins).to.have.property('length').that.is.gt(0)
      expect(goPins).to.deep.include.members(jsPins)
      expect(jsPins).to.deep.include.members(goPins)
    })
  })

  // FIXME: https://github.com/ipfs/js-ipfs/issues/1467
  describe.skip('go and js pinset storage are compatible', function () {
    function pipeline (options) {
      // by starting each daemon with the same repoPath, they
      // will read/write pins from the same datastore.
      const repoPath = utils.tmpPath()
      const content = uint8ArrayFromString(String(Math.random()))
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
          expect(goPins).to.have.property('length').that.is.gt(0)
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
