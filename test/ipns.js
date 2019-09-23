/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const os = require('os')
const path = require('path')
const hat = require('hat')

const { spawnInitAndStartGoDaemon, spawnInitAndStartJsDaemon } = require('./utils/daemon')
const timeout = require('./utils/timeout')

const dir = path.join(os.tmpdir(), hat())

const jsDaemonOptions = {
  repoPath: dir,
  disposable: false,
  initOptions: { bits: 512 }
}

const goDaemonOptions = {
  repoPath: dir,
  disposable: false
}

const ipfsRef = '/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU'

const publishAndResolve = async (publisherDaemon, resolverDaemon) => {
  let sameDaemon = false

  if (!resolverDaemon) {
    resolverDaemon = publisherDaemon
    sameDaemon = true
  }

  const stopPublisherAndStartResolverDaemon = async () => {
    await publisherDaemon.stop()
    await timeout(2000)
    await resolverDaemon.start(['--offline'])
  }

  await publisherDaemon.init()
  await publisherDaemon.start(['--offline'])
  const result = await publisherDaemon.api.id()
  const nodeId = result.id

  await publisherDaemon.api.name.publish(ipfsRef, { resolve: false, 'allow-offline': true })

  !sameDaemon && await stopPublisherAndStartResolverDaemon()

  const res = await resolverDaemon.api.name.resolve(nodeId, { local: true })
  expect(res).to.equal(ipfsRef)

  await resolverDaemon.stop()
  timeout(2000)

  await resolverDaemon.cleanup()
}

describe('ipns locally using the same repo across implementations', () => {
  it('should publish an ipns record to a js daemon and resolve it using the same js daemon', async function () {
    this.timeout(120 * 1000)

    const jsDaemon = await spawnInitAndStartJsDaemon(jsDaemonOptions)

    await publishAndResolve(jsDaemon)
  })

  it('should publish an ipns record to a go daemon and resolve it using the same go daemon', async function () {
    this.timeout(160 * 1000)

    const goDaemon = await spawnInitAndStartGoDaemon(goDaemonOptions)

    await publishAndResolve(goDaemon)
  })

  it('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', async function () {
    this.timeout(120 * 1000)

    const daemons = await Promise.all([
      spawnInitAndStartJsDaemon(jsDaemonOptions),
      spawnInitAndStartGoDaemon(goDaemonOptions)
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })

  it('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', async function () {
    this.timeout(160 * 1000)

    const daemons = await Promise.all([
      spawnInitAndStartGoDaemon(goDaemonOptions),
      spawnInitAndStartJsDaemon(jsDaemonOptions)
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })
})
