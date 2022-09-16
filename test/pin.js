/* eslint-env mocha */

import fs from 'fs'
import all from 'it-all'
import last from 'it-last'
import drain from 'it-drain'
import { tmpPath, removeAllPins } from './utils/pin-utils.js'
import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

describe('pin', function () {
  this.timeout(60e3)
  this.slow(30e3)

  /** @type {Factory} */
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
  /**
   * @param {'go' | 'js'} type
   * @param {string} [repoPath]
   */
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

  /**
   * @template T
   * @param {(controller: Controller) => Promise<T>} pipeline
   * @returns {Promise<[T, T]>}
   */
  async function withDaemons (pipeline) {
    const goDaemon = await spawnAndStart('go')
    await removeAllPins(goDaemon)

    const jsDaemon = await spawnAndStart('js')
    await removeAllPins(jsDaemon)

    return Promise.all([pipeline(goDaemon), pipeline(jsDaemon)])
  }

  afterEach(async function () {
    this.timeout(25e3)
    await factory.clean()
    daemons = []
  })

  describe('pin add', function () {
    // Pinning a large file recursively results in the same pins
    it('pin recursively', async function () {
      /**
       * @param {Controller} daemon
       */
      async function pipeline (daemon) {
        const res = await last(daemon.api.addAll(jupiter, { pin: false }))

        if (!res) {
          throw new Error('Nothing added')
        }

        const { cid } = res

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
      /**
       * @param {Controller} daemon
       */
      async function pipeline (daemon) {
        const res = await last(daemon.api.addAll(jupiter, { pin: false }))

        if (!res) {
          throw new Error('Nothing added')
        }

        const { cid } = res

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
      /**
       * @param {Controller} daemon
       */
      async function pipeline (daemon) {
        const res = await last(daemon.api.addAll(jupiter))

        if (!res) {
          throw new Error('Nothing added')
        }

        const { cid } = res

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
      /** @type {Awaited<ReturnType<Controller["api"]["files"]["stat"]>>} */
      let jupiterDir

      /**
       * @param {Controller} daemon
       */
      async function pipeline (daemon) {
        const res = await last(daemon.api.addAll(jupiter, { pin: false, wrapWithDirectory: true }))

        if (!res) {
          throw new Error('Nothing added')
        }

        const { cid } = res

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
      expect(dirPin).to.have.property('type', 'indirect')
    })
  })

  describe('ls', function () {
    it('print same pins', async function () {
      /**
       * @param {Controller} daemon
       */
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
