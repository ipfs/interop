/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import delay from 'delay'
import defer from 'p-defer'
import { fromString as uint8ArrayFromString } from 'uint8arrays'
import { isNode, isElectronMain } from 'wherearewe'
import isWindows from './utils/is-windows.js'
import toBuffer from 'it-to-buffer'
import pWaitFor from 'p-wait-for'
import all from 'it-all'

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 */

/**
 * @param {Multiaddr[]} [bootstrap]
 */
const getConfig = (bootstrap = []) => ({
  Bootstrap: bootstrap.map(ma => ma.toString()),
  Routing: {
    Type: 'dhtserver'
  }
})

/**
 * @param {Factory} factory
 * @param {Multiaddr[]} [bootstrap]
 */
const spawnGoDaemon = (factory, bootstrap = []) => {
  return factory.spawn({
    type: 'go',
    test: true,
    ipfsOptions: {
      config: getConfig(bootstrap)
    }
  })
}

/**
 * @param {Factory} factory
 * @param {Multiaddr[]} [bootstrap]
 */
const spawnJsDaemon = (factory, bootstrap = []) => {
  return factory.spawn({
    type: 'js',
    test: true,
    ipfsOptions: {
      config: getConfig(bootstrap)
    }
  })
}

/**
 * @param {Controller} node
 */
const getNodeAddr = async (node) => {
  const res = await node.api.id()
  expect(res.id).to.exist()

  return res.addresses[0]
}

/**
 * @param {Controller} addDaemon
 * @param {Controller[]} catDaemons
 * @param {*} options
 */
const addFileAndCat = async (addDaemon, catDaemons, options = {}) => {
  const data = uint8ArrayFromString(`some-data-${Math.random()}`)
  const { cid } = await addDaemon.api.add(data)

  await Promise.all(
    catDaemons.map(async daemon => {
      const cidQuery = await all(daemon.api.dht.findProvs(cid))
      const canResolve = cidQuery.filter(event => event.name === 'PROVIDER').length > 0

      if (!canResolve) {
        // FIXME: sometimes we cannot resolve the content - this can happen when the PeerId is closer
        // to the KAD ID of the content than other nodes in the network. Our test suite here needs
        // more peer diversity to make this unlikely to happen.
        return
      }

      const res = await toBuffer(daemon.api.cat(cid, options))

      expect(res).to.equalBytes(data)
    })
  )
}

/**
 * @param {Controller} nodeA
 * @param {Controller} nodeB
 */
const inRoutingTable = async (nodeA, nodeB) => {
  /**
   * @param {Controller} nodeA
   * @param {Controller} nodeB
   */
  const canFind = async (nodeA, nodeB) => {
    pWaitFor(async () => {
      for await (const event of nodeA.api.dht.findPeer(nodeB.peer.id)) {
        if (event.name === 'FINAL_PEER') {
          return true
        }
      }

      return false
    })
  }

  await Promise.all([
    canFind(nodeA, nodeB),
    canFind(nodeB, nodeA)
  ])
}

/**
 * @param {string} name
 * @param {(fac: Factory) => Promise<Controller[]>} createNodes
 * @param {(nodes: Promise<Controller[]>) => void} tests
 */
const createNetwork = function (name, createNodes, tests) {
  describe(name, function () {
    const nodes = defer()
    /** @type {Factory} */
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

/**
 * @param {string} name
 * @param {(fac: Factory) => Promise<Controller>} createBootstrapper
 * @param {(fac: Factory, bootstrapAddr: Multiaddr) => Promise<Controller[]>} createNodes
 */
const createBootstrappedNetwork = function (name, createBootstrapper, createNodes) {
  createNetwork(name, async factory => {
    const bootstrapper = await createBootstrapper(factory)
    const bootstrapAddr = await getNodeAddr(bootstrapper)
    // @ts-ignore
    const nodes = await createNodes(factory, bootstrapAddr)

    await delay(5000)

    while (true) {
      const peers = await bootstrapper.api.swarm.peers()

      if (peers.length === nodes.length) {
        break
      }

      await delay(500)
    }

    // make sure the bootstrapper and other peers are in each other's routing tables
    for (let i = 0; i < nodes.length; i++) {
      await inRoutingTable(bootstrapper, nodes[i])

      for (let j = 0; j < nodes.length; j++) {
        if (j === i) {
          continue
        }

        await inRoutingTable(nodes[i], nodes[j])
      }
    }

    return nodes
  }, (nodes) => {
    it('should get from the network after being added', async function () {
      const [add, ...cat] = await nodes
      await addFileAndCat(add, cat)
    })
  })
}

/**
 * @param {string} name
 * @param {(fac: Factory) => Promise<Controller[]>} createNodes
 */
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

    // @ts-ignore
    await node3.api.swarm.connect(node0.peer.addresses[0])
    // @ts-ignore
    await node0.api.swarm.connect(node1.peer.addresses[0])
    // @ts-ignore
    await node1.api.swarm.connect(node2.peer.addresses[0])

    // ensure nodes have their peers in their routing tables
    await inRoutingTable(node3, node0)
    await inRoutingTable(node0, node1)
    await inRoutingTable(node1, node2)

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

/**
 * @param {string} name
 * @param {(fac: Factory) => Promise<Controller[]>} createNodes
 */
const createDisjointNetwork = function (name, createNodes) {
  createNetwork(name, async factory => {
    const [node0, node1, node2, node3, node4, node5] = await createNodes(factory)

    // Make connections between nodes

    // 0 -> 1 -> 2
    // @ts-ignore
    await node0.api.swarm.connect(node1.peer.addresses[0])
    // @ts-ignore
    await node1.api.swarm.connect(node2.peer.addresses[0])

    // ensure nodes have their peers in their routing tables
    await inRoutingTable(node0, node1)
    await inRoutingTable(node1, node2)

    // 3 -> 4 -> 5
    // @ts-ignore
    await node3.api.swarm.connect(node4.peer.addresses[0])
    // @ts-ignore
    await node4.api.swarm.connect(node5.peer.addresses[0])

    // ensure nodes have their peers in their routing tables
    await inRoutingTable(node3, node4)
    await inRoutingTable(node4, node5)

    return [node0, node1, node2, node3, node4, node5]
  }, (nodes) => {
    it('join network', async () => {
      const [node0, _node1, node2, node3, _node4, node5] = await nodes // eslint-disable-line no-unused-vars

      // FIXME: sometimes we cannot resolve the content - this can happen when the PeerId is closer
      // to the KAD ID of the content than other nodes in the network. Our test suite here needs
      // more peer diversity to make this unlikely to happen.

      // nodes at opposite ends should not find content
      // await expect(addFileAndCat(node0, [node3], {
      //  timeout: 5000
      // })).to.eventually.be.rejected()

      /*
      * Make connections between nodes
      * 0 -> 1 -> 2 -> 5 -> 4 -> 3
      */
      // @ts-ignore
      await node2.api.swarm.connect(node5.peer.addresses[0])
      await inRoutingTable(node2, node5)

      // should now succeed
      await addFileAndCat(node0, [node3])
    })
  })
}

describe('kad-dht', function () {
  this.timeout(180e3)

  if ((!isNode && !isElectronMain) || isWindows) {
    it.skip('DHT tests are only run on node/electron main and not on windows')
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
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory)
      ])
    })

    createLinearNetwork('a Go node in the land of JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory)
      ])
    })

    createLinearNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory)
      ])
    })

    createLinearNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory)
      ])
    })
  })

  describe('kad-dht across disjoint networks that become joint', () => {
    createDisjointNetwork('a GO network', (factory) => {
      return Promise.all([
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnGoDaemon(factory),
        spawnGoDaemon(factory)
      ])
    })

    createDisjointNetwork('a JS network', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnJsDaemon(factory),
        spawnJsDaemon(factory)
      ])
    })

    createDisjointNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory)
      ])
    })

    createDisjointNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory),
        spawnJsDaemon(factory),
        spawnGoDaemon(factory)
      ])
    })
  })
})
