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

const isWindows = os.platform() === 'win32'

const { spawnInitAndStartGoDaemon, spawnInitAndStartJsDaemon } = require('./utils/daemon')
const timeout = require('./utils/timeout')

async function catAndCheck (api, hash, data) {
  api.cat(hash, (err, fileData) => {
    expect(err).to.not.exist()
    expect(fileData).to.eql(data)
  })

  const fileData = await api.cat(hash)
  expect(fileData).to.eql(data)
}

describe('repo', () => {
  if (isWindows) {
    return
  }

  it('read repo: go -> js', async function () {
    this.timeout(50 * 1000)

    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const goDaemon = await spawnInitAndStartGoDaemon({
      repoPath: dir,
      disposable: false
    })
    await goDaemon.init()
    await goDaemon.start()

    const res = await goDaemon.api.add(data)
    const hash = res[0].hash

    await catAndCheck(goDaemon.api, hash, data)
    await goDaemon.stop()

    const jsDaemon = await spawnInitAndStartJsDaemon({
      repoPath: dir,
      disposable: false,
      initOptions: { bits: 512 }
    })

    await jsDaemon.start()
    await catAndCheck(jsDaemon.api, hash, data)
    await jsDaemon.stop()

    await timeout(10500)

    await jsDaemon.cleanup()
  })

  it('read repo: js -> go', async function () {
    this.timeout(80 * 1000)
    const dir = path.join(os.tmpdir(), hat())
    const data = crypto.randomBytes(1024 * 5)

    const jsDaemon = await spawnInitAndStartJsDaemon({
      repoPath: dir,
      disposable: false,
      initOptions: { bits: 512 }
    })
    await jsDaemon.init()
    await jsDaemon.start()

    const res = await jsDaemon.api.add(data)
    const hash = res[0].hash

    await catAndCheck(jsDaemon.api, hash, data)
    await jsDaemon.stop()

    const goDaemon = await spawnInitAndStartGoDaemon({
      repoPath: dir,
      disposable: false
    })
    await goDaemon.start()
    await catAndCheck(goDaemon.api, hash, data)
    await goDaemon.stop()
  })
})
