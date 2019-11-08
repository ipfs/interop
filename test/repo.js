/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const crypto = require('crypto')
const os = require('os')
const path = require('path')
const hat = require('hat')
const delay = require('delay')

const isWindows = os.platform() === 'win32'

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

async function catAndCheck (api, hash, data) {
  const fileData = await api.cat(hash)
  expect(fileData).to.eql(data)
}

describe('repo', function () {
  this.timeout(80 * 1000)

  if (isWindows) {
    return
  }

  it('read repo: go -> js', async function () {
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const goDaemon = await spawnGoDaemon({
      repoPath: dir,
      disposable: false
    })
    await goDaemon.init()
    await goDaemon.start()

    const res = await goDaemon.api.add(data)
    const hash = res[0].hash

    await catAndCheck(goDaemon.api, hash, data)
    await goDaemon.stop()

    const jsDaemon = await spawnJsDaemon({
      repoPath: dir,
      disposable: false
    })

    await jsDaemon.start()
    await catAndCheck(jsDaemon.api, hash, data)
    await jsDaemon.stop()

    await delay(10500)

    await jsDaemon.cleanup()
  })

  it('read repo: js -> go', async function () {
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const jsDaemon = await spawnJsDaemon({
      repoPath: dir,
      disposable: false
    })
    await jsDaemon.init()
    await jsDaemon.start()

    const res = await jsDaemon.api.add(data)
    const hash = res[0].hash

    await catAndCheck(jsDaemon.api, hash, data)
    await jsDaemon.stop()

    const goDaemon = await spawnGoDaemon({
      repoPath: dir,
      disposable: false
    })
    await goDaemon.start()
    await catAndCheck(goDaemon.api, hash, data)
    await goDaemon.stop()
  })
})
