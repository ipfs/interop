/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */

import { expect } from 'aegir/utils/chai.js'
import { daemonFactory } from './utils/daemon-factory.js'
import delay from 'delay'
import defer from 'p-defer'
import { fromString as uint8ArrayFromString } from 'uint8arrays'
import { isNode } from 'wherearewe'
import toBuffer from 'it-to-buffer'

const getConfig = (bootstrap) => ({
  Bootstrap: bootstrap,
  Routing: {
    Type: 'dhtserver'
  }
})

const spawnGoDaemon = (factory, bootstrap = []) => {
  return factory.spawn({
    type: 'go',
    test: true,
    ipfsOptions: {
      config: getConfig(bootstrap)
    }
  })
}

const spawnJsDaemon = (factory, bootstrap = []) => {
  return factory.spawn({
    type: 'js',
    test: true,
    ipfsOptions: {
      config: getConfig(bootstrap)
    }
  })
}

const spawnDaemon = async function (factory, fn) {
  const daemon = await fn(factory)
  const id = await daemon.api.id()

  return {
    api: daemon.api, id
  }
}

const getNodeAddr = async (node) => {
  const res = await node.api.id()
  expect(res.id).to.exist()

  return res.addresses[0]
}

const addFileAndCat = async (addDaemon, catDaemons, options = {}) => {
  const data = uint8ArrayFromString(`some-data-${Math.random()}`)
  const { cid } = await addDaemon.api.add(data)

  await Promise.all(
    catDaemons.map(async daemon => {
      const res = await toBuffer(daemon.api.cat(cid, options))

      expect(res).to.equalBytes(data)
    })
  )
}

const createNetwork = function (name, createNodes, tests) {
  describe(name, function () {
    const nodes = defer()
    let factory

    before(async function () {
      factory = await daemonFactory()
      nodes.resolve(await createNodes(factory))
    })

    after(async function () {
      await factory.clean()
    })

    tests(nodes.promise)
  })
}

const createBootstrappedNetwork = function (name, createBootstrapper, createNodes) {
  createNetwork(name, async factory => {
    const bootstrapper = await createBootstrapper(factory)
    const bootstrapAddr = await getNodeAddr(bootstrapper)
    const nodes = await createNodes(factory, bootstrapAddr)

    while (true) {
      const peers = await bootstrapper.api.swarm.peers()

      if (peers.length === nodes.length) {
        break
      }

      await delay(500)
    }

    return nodes
  }, (nodes) => {
    it('should get from the network after being added', async function () {
      const [add, ...cat] = await nodes
      await addFileAndCat(add, cat)
    })
  })
}

const createLinearNetwork = function (name, createNodes) {
  createNetwork(name, async factory => {
    const [node0, node1, node2, node3] = await createNodes(factory)

    /*
     * Make connections between nodes
     * +-+       +-+
     * |0+-----> |1|
     * +++       +++
     *  ^         |
     *  |         |
     *  |         v
     * +++       +++
     * |3|       |2|
     * +-+       +-+
     */
    await node3.api.swarm.connect(node0.id.addresses[0])
    await node0.api.swarm.connect(node1.id.addresses[0])
    await node1.api.swarm.connect(node2.id.addresses[0])

    return [node0, node1, node2, node3]
  }, (nodes) => {
    it('one hop', async () => {
      const [node0, _node1, _node2, node3] = await nodes // eslint-disable-line no-unused-vars
      await addFileAndCat(node0, [node3])
    })
    it('two hops', async () => {
      const [_node0, node1, _node2, node3] = await nodes // eslint-disable-line no-unused-vars
      await addFileAndCat(node1, [node3])
    })
    it('three hops', async () => {
      const [_node0, _node1, node2, node3] = await nodes // eslint-disable-line no-unused-vars
      await addFileAndCat(node2, [node3])
    })
  })
}

const createDisjointNetwork = function (name, createNodes) {
  createNetwork(name, async factory => {
    const [node0, node1, node2, node3, node4, node5] = await createNodes(factory)

    // Make connections between nodes

    // 0 -> 1 -> 2
    await node0.api.swarm.connect(node1.id.addresses[0])
    await node1.api.swarm.connect(node2.id.addresses[0])

    // 3 -> 4 -> 5
    await node3.api.swarm.connect(node4.id.addresses[0])
    await node4.api.swarm.connect(node5.id.addresses[0])

    return [node0, node1, node2, node3, node4, node5]
  }, (nodes) => {
    it('join network', async () => {
      const [node0, _node1, node2, node3, _node4, node5] = await nodes // eslint-disable-line no-unused-vars

      // nodes at opposite ends should not find content
      await expect(addFileAndCat(node0, [node3], {
        timeout: 5000
      })).to.eventually.be.rejected()

      /*
      * Make connections between nodes
      * 0 -> 1 -> 2 -> 5 -> 4 -> 3
      */

      await node2.api.swarm.connect(node5.id.addresses[0])

      // should now succeed
      await addFileAndCat(node0, [node3])
    })
  })
}

describe('kad-dht', function () {
  this.timeout(600 * 1000)

  if (!isNode) {
    it.skip('DHT tests are only run on node')
    return
  }

  describe('kad-dht with a bootstrap node', () => {
    createBootstrappedNetwork('a JS network', factory => spawnJsDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr])
      ])
    })

    createBootstrappedNetwork('a GO network', factory => spawnGoDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr])
      ])
    })

    createBootstrappedNetwork('a JS bootstrap node in the land of Go', factory => spawnJsDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr])
      ])
    })

    createBootstrappedNetwork('a Go bootstrap node in the land of JS', factory => spawnGoDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr])
      ])
    })

    createBootstrappedNetwork('a JS bootstrap node in a hybrid land', factory => spawnJsDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr])
      ])
    })

    createBootstrappedNetwork('a Go bootstrap node in a hybrid land', factory => spawnGoDaemon(factory), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, [bootstrapAddr]),
        spawnGoDaemon(factory, [bootstrapAddr]),
        spawnJsDaemon(factory, [bootstrapAddr])
      ])
    })
  })

  describe('kad-dht with multiple hops', () => {
    createLinearNetwork('a JS node in the land of Go', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon)
      ])
    })

    createLinearNetwork('a Go node in the land of JS', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon)
      ])
    })

    createLinearNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon)
      ])
    })

    createLinearNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon)
      ])
    })
  })

  describe('kad-dht across disjoint networks that become joint', () => {
    createDisjointNetwork('a GO network', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnGoDaemon)
      ])
    })

    createDisjointNetwork('a JS network', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnJsDaemon)
      ])
    })

    createDisjointNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon)
      ])
    })

    createDisjointNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon),
        spawnDaemon(factory, spawnJsDaemon),
        spawnDaemon(factory, spawnGoDaemon)
      ])
    })
  })
})
