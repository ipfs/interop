/* eslint-env mocha */
'use strict'

const os = require('os')
const path = require('path')
const { nanoid } = require('nanoid')
const delay = require('delay')
const last = require('it-last')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')

const dir = path.join(os.tmpdir(), nanoid())

const daemonOptions = {
  disposable: false,
  args: ['--offline'],
  ipfsOptions: {
    repo: dir
  }
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
    await resolverDaemon.start()
  }

  await publisherDaemon.init()
  await publisherDaemon.start()

  const nodeId = publisherDaemon.api.peerId.id

  await publisherDaemon.api.name.publish(ipfsRef, {
    resolve: false,
    allowOffline: true
  })

  !sameDaemon && await stopPublisherAndStartResolverDaemon()

  const res = await last(resolverDaemon.api.name.resolve(nodeId, { local: true }))
  expect(res).to.equal(ipfsRef)

  await resolverDaemon.stop()
  await delay(2000)

  await resolverDaemon.cleanup()
}

describe('ipns locally using the same repo across implementations', function () {
  this.timeout(160 * 1000)

  afterEach(() => daemonFactory.clean())

  it('should publish an ipns record to a js daemon and resolve it using the same js daemon', async function () {
    const jsDaemon = await daemonFactory.spawn({
      ...daemonOptions,
      type: 'js'
    })

    await publishAndResolve(jsDaemon)
  })

  it('should publish an ipns record to a go daemon and resolve it using the same go daemon', async function () {
    const goDaemon = await daemonFactory.spawn({
      ...daemonOptions,
      type: 'go'
    })

    await publishAndResolve(goDaemon)
  })

  // FIXME: https://github.com/ipfs/js-ipfs/issues/1467
  //
  // Repo versions are different.
  it.skip('should publish an ipns record to a js daemon and resolve it using a go daemon through the reuse of the same repo', async function () {
    const daemons = await Promise.all([
      daemonFactory.spawn({
        ...daemonOptions,
        type: 'js'
      }),
      daemonFactory.spawn({
        ...daemonOptions,
        type: 'go'
      })
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })

  // FIXME: https://github.com/ipfs/js-ipfs/issues/1467
  //
  // Repo versions are different.
  it.skip('should publish an ipns record to a go daemon and resolve it using a js daemon through the reuse of the same repo', async function () {
    const daemons = await Promise.all([
      daemonFactory.spawn({
        ...daemonOptions,
        type: 'go'
      }),
      daemonFactory.spawn({
        ...daemonOptions,
        type: 'js'
      })
    ])

    await publishAndResolve(daemons[0], daemons[1])
  })
})
