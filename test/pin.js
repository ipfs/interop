/* eslint-env mocha */

import fs from 'fs'
import all from 'it-all'
import last from 'it-last'
import drain from 'it-drain'
import { tmpPath, removeAllPins } from './utils/pin-utils.js'
import { expect } from 'aegir/utils/chai.js'
import { daemonFactory } from './utils/daemon-factory.js'

describe('pin', function () {
  this.timeout(60 * 1000)
  this.slow(30 * 1000)

  let factory

  before(async () => {
    factory = await daemonFactory()
  })

  const filePath = 'test/fixtures/planets/jupiter-from-cassini.jpg'
  const jupiter = [{
    path: filePath,
    content: fs.readFileSync(filePath)
  }]

  let daemons = []
  async function spawnAndStart (type, repoPath = tmpPath()) {
    const daemonOptions = {
      ipfsOptions: {
        repo: repoPath
      },
      disposable: false
    }

    const daemon = await factory.spawn({
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
    await removeAllPins(goDaemon)

    const jsDaemon = await spawnAndStart('js')
    await removeAllPins(jsDaemon)

    return Promise.all([pipeline(goDaemon), pipeline(jsDaemon)])
  }

  afterEach(async function () {
    this.timeout(25 * 1000)
    await factory.clean()
    daemons = []
  })

  describe('pin add', function () {
    // Pinning a large file recursively results in the same pins
    it('pin recursively', async function () {
      async function pipeline (daemon) {
        const { cid } = await last(daemon.api.addAll(jupiter, { pin: false }))
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
        const { cid } = await last(daemon.api.addAll(jupiter, { pin: false }))
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
        const { cid } = await last(daemon.api.addAll(jupiter))
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
        const { cid } = await last(daemon.api.addAll(jupiter, { pin: false, wrapWithDirectory: true }))
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
        await drain(daemon.api.addAll(jupiter))

        return all(daemon.api.pin.ls())
      }

      const [goPins, jsPins] = await withDaemons(pipeline)

      expect(goPins).to.have.property('length').that.is.gt(0)
      expect(goPins).to.deep.include.members(jsPins)
      expect(jsPins).to.deep.include.members(goPins)
    })
  })
})
