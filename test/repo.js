/* eslint-env mocha */
'use strict'

const crypto = require('crypto')
const os = require('os')
const path = require('path')
const hat = require('hat')
const concat = require('it-concat')
const last = require('it-last')
const { expect } = require('./utils/chai')
const { goDaemonFactory, jsDaemonFactory } = require('./utils/daemon-factory')

const isWindows = os.platform() === 'win32'

async function catAndCheck (api, cid, data) {
  const fileData = await concat(api.cat(cid))
  expect(fileData.slice()).to.eql(data)
}

describe('repo', function () {
  this.timeout(80 * 1000)

  if (isWindows) {
    return
  }

  it('read repo: go -> js', async function () {
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const goDaemon = await goDaemonFactory.spawn({
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })
    await goDaemon.init()
    await goDaemon.start()

    const { cid } = await last(goDaemon.api.add(data))

    await catAndCheck(goDaemon.api, cid, data)
    await goDaemon.stop()

    const jsDaemon = await jsDaemonFactory.spawn({
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })

    await jsDaemon.start()
    await catAndCheck(jsDaemon.api, cid, data)
    await jsDaemon.stop()

    await jsDaemon.cleanup()
  })

  it('read repo: js -> go', async function () {
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const jsDaemon = await jsDaemonFactory.spawn({
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })
    await jsDaemon.init()
    await jsDaemon.start()

    const { cid } = await last(jsDaemon.api.add(data))

    await catAndCheck(jsDaemon.api, cid, data)
    await jsDaemon.stop()

    const goDaemon = await goDaemonFactory.spawn({
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })
    await goDaemon.start()
    await catAndCheck(goDaemon.api, cid, data)
    await goDaemon.stop()

    await goDaemon.cleanup()
  })
})
