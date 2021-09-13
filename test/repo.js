/* eslint-env mocha */
'use strict'

const randomBytes = require('iso-random-stream/src/random')
const os = require('os')
const path = require('path')
const { nanoid } = require('nanoid')
const delay = require('delay')
const concat = require('it-concat')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')

const isWindows = os.platform() === 'win32'

async function catAndCheck (api, cid, data) {
  const fileData = await concat(api.cat(cid))
  expect(fileData.slice()).to.eql(data)
}

// Repo compatibility is broken.
//
// FIXME: https://github.com/ipfs/js-ipfs/issues/1467
describe.skip('repo', function () {
  this.timeout(80 * 1000)

  if (isWindows) {
    return
  }

  afterEach(() => daemonFactory.clean())

  it('read repo: go -> js', async function () {
    const dir = path.join(os.tmpdir(), nanoid())
    const data = randomBytes(1024 * 5)

    const goDaemon = await daemonFactory.spawn({
      type: 'go',
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })
    await goDaemon.init()
    await goDaemon.start()

    const { cid } = await goDaemon.api.add(data)

    await catAndCheck(goDaemon.api, cid, data)
    await goDaemon.stop()

    const jsDaemon = await daemonFactory.spawn({
      type: 'js',
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
    const dir = path.join(os.tmpdir(), nanoid())
    const data = randomBytes(1024 * 5)

    const jsDaemon = await daemonFactory.spawn({
      type: 'js',
      ipfsOptions: {
        repo: dir
      },
      disposable: false
    })
    await jsDaemon.init()
    await jsDaemon.start()

    const { cid } = await jsDaemon.api.add(data)

    await catAndCheck(jsDaemon.api, cid, data)
    await jsDaemon.stop()

    await delay(1000)

    const goDaemon = await daemonFactory.spawn({
      type: 'go',
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
