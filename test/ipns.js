/* eslint-env mocha */
'use strict'

const os = require('os')
const path = require('path')
const hat = require('hat')
const delay = require('delay')
const { expect } = require('./utils/chai')

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

const dir = path.join(os.tmpdir(), hat())

const daemonOptions = {
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
    await delay(2000)
    await resolverDaemon.start(['--offline'])
  }

  await publisherDaemon.init()
  await publisherDaemon.start(['--offline'])
  const result = await publisherDaemon.api.id()
  const nodeId = result.id

  await publisherDaemon.api.name.publish(ipfsRef, { resolve: false, allowOffline: true })

  !sameDaemon && await stopPublisherAndStartResolverDaemon()

  const res = await resolverDaemon.api.name.resolve(nodeId, { local: true })
  expect(res).to.equal(ipfsRef)

  await resolverDaemon.stop()
  await delay(2000)

  await resolverDaemon.cleanup()
}

describe('ipns locally using the same repo across implementations', function () {
  this.timeout(160 * 1000)

  it('should publish an ipns record to a js daemon and resolve it using the same js daemon', async function () {
    const jsDaemon = await spawnJsDaemon(daemonOptions)

    await publishAndResolve(jsDaemon)
  })

  it('should publish an ipns record to a go daemon and resolve it using the same go daemon', async function () {
    const goDaemon = await spawnGoDaemon(daemonOptions)

    await publishAndResolve(goDaemon)
  })

  it('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', async function () {
    const daemons = await Promise.all([
      spawnJsDaemon(daemonOptions),
      spawnGoDaemon(daemonOptions)
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })

  it('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', async function () {
    const daemons = await Promise.all([
      spawnGoDaemon(daemonOptions),
      spawnJsDaemon(daemonOptions)
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })
})
