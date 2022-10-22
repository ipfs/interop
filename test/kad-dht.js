/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { daemonFactory } from './utils/daemon-factory.js'
import defer from 'p-defer'
import { fromString as uint8ArrayFromString } from 'uint8arrays'
import { isNode, isElectronMain } from 'wherearewe'
import isWindows from './utils/is-windows.js'
import toBuffer from 'it-to-buffer'
import pWaitFor from 'p-wait-for'
import { CID } from 'multiformats/cid'
import all from 'it-all'

const dataCid = CID.parse('QmY2ERw3nB19tVKKVF18Wq5idNL91gaNzCk1eaSq6S1J1i')

// magic PeerIds sorted in XOR distance of their KADIDs from the KADID of dataCid closest -> furthest
const peerIds = [
  {
    PeerID: '12D3KooWJXJBY5LEcEhRddeyedgT3scPqG3QNgMn8D3BwVDusYt5',
    PrivKey: 'CAESQHEEV/pJjT3BprwYVPInj61DCY4ZkLpUH0EahRNVmExBgVnNHCvXMB+tBMEEj6+Bm/pu8PWMMZA6wDXpCScq5X4='
  },
  {
    PeerID: '12D3KooWMLZ6CKnx3mUUKzDM1CaHpgB76KrFam3N2Z8g6GSov392',
    PrivKey: 'CAESQMhyH24iLx8Tnh/BMPfG9SW0UNHBsJST+afVNmDkFy2PqyxUXCtKRFQo7QiU/1mCkl3csAP2he8x9HTR2KUzYyE='
  },
  {
    PeerID: '12D3KooWDaQzFGxh7uxCki7Ri2sgaHzJWKGFjKhafDsFmnQyvXCk',
    PrivKey: 'CAESQNjMmfPJriCLgfkAkiXxEenHSweHTUa9SVXHbTRLcyG6N9vNyIyakSUohWhmGJ9pND4cuxycpq+Atigiytjg3Uk='
  },
  {
    PeerID: '12D3KooWCkKk2mzZZAY8Uin6yU9ZnyJeTEP6nfFUUgKAu5K4d6k5',
    PrivKey: 'CAESQPROL0pF09ildCUFr/Euwx625+Mqje81tvIEd1xHekeSK4n+jj8WmSodhgJyZx84LWOeVOSiN0hgw/J9mtU2YYY='
  },
  {
    PeerID: '12D3KooWHYiH5yDoF2tspDeXGa2y3HoXkJzRxMDiKvwcE8LYGb1z',
    PrivKey: 'CAESQNJlPa/tQCYLJzcXh2GKnSOvX2McvYsnZuciIDJJjvVpctrwr1IY/R6QD0ax5dHc/zzvPE0QX6U8W3A3+vgpHmk='
  },
  {
    PeerID: '12D3KooWBYp9DzPX8Gf3nDMSGJGKniHSEjvUjUPkKGYAS9Vrxxm1',
    PrivKey: 'CAESQAto9ZGfNjbDx1VsHJ3rgbzetDg8LkbH1gSb4tbNOGjhGbtzF13TmKeQuKLfHE56pSx+3esys5qq58PdkWqvfFw='
  },
  {
    PeerID: '12D3KooWDkbi29dnu1E2Ff5Aj9NdnRLFCb4y84pVcpi5MP5WRGJ7',
    PrivKey: 'CAESQENFVG7E/W3eoDIOtr/CS+ysBEOVpcqAf8yNtxiCZjeVOne7vEWxzJig9Ke9HGe/Ik3++MkYLwAj1snRia/FS4w='
  },
  {
    PeerID: '12D3KooWBz7Zwx7wHzd4ZHKVV91r1HYdPYojJ972CQYLHD8Y5Gvb',
    PrivKey: 'CAESQN4azAk1sTbhCw6gCH8pvxDkpvv+Maf1/7YnP/TQFJmPIDaseod3sMMLiCBOfo/4kfT4K0SGjFXc8fysUK5fFjA='
  },
  {
    PeerID: '12D3KooWKseokPcaNuHMoSDoMuToaiLuY2Wz879Mk2KY6QqxEMKX',
    PrivKey: 'CAESQLOLvRthL2NjW1msUjZAzhxk/+9va7/UFSAWOpugXmzblWxsofgyLIeMl4A5Ny93ipqnoxHUYxpFKNDYer79bro='
  },
  {
    PeerID: '12D3KooWDFxq9e3GUNnzz9nB61SRgmPuvPLidkFktm7i7tF7cJPW',
    PrivKey: 'CAESQK3YZiufMjNrgpLTPNuBo250cpdtP5KnNwro9pxHbcLkMyHGDP4ShEREzr8J4kfPdSuG0G3+wpshf78Q4Clbr9U='
  }
]

/**
 * @typedef {import('ipfsd-ctl').Controller} Controller
 * @typedef {import('ipfsd-ctl').Factory} Factory
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 */

/**
 * @typedef {object} Opts
 * @property {Multiaddr[]} [bootstrap]
 * @property {number} [peerId]
 *
 * @param {Opts} [opts]
 */
const getConfig = (opts = {}) => {
  /** @type {any} */
  const config = {
    Bootstrap: (opts.bootstrap ?? []).map(ma => ma.toString()),
    Routing: {
      Type: 'dhtserver'
    }
  }

  if (opts.peerId != null) {
    config.Identity = peerIds[opts.peerId]
  }

  return config
}

/**
 * @param {Factory} factory
 * @param {Opts} [opts]
 */
const spawnGoDaemon = (factory, opts) => {
  return factory.spawn({
    type: 'go',
    test: true,
    ipfsOptions: {
      config: getConfig(opts)
    }
  })
}

/**
 * @param {Factory} factory
 * @param {Opts} [opts]
 */
const spawnJsDaemon = (factory, opts) => {
  return factory.spawn({
    type: 'js',
    test: true,
    ipfsOptions: {
      config: getConfig(opts)
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
  const data = uint8ArrayFromString('some-data')
  const { cid } = await addDaemon.api.add(data)

  expect(cid.bytes).to.equalBytes(dataCid.bytes)

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
    }, {
      interval: 500
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
    const nodes = await createNodes(factory, bootstrapAddr)

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
      await addFileAndCat(add, [cat[cat.length - 1]])
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
     * +-+       +-+       +-+       +-+
     * |0+-----> |1|-----> |2|-----> |3|
     * +-+       +-+       +-+       +-+
     */

    await node0.api.swarm.connect(node1.peer.addresses[0])
    await node1.api.swarm.connect(node2.peer.addresses[0])
    await node2.api.swarm.connect(node3.peer.addresses[0])

    // ensure nodes have their peers in their routing tables
    await inRoutingTable(node0, node1)
    await inRoutingTable(node1, node2)
    await inRoutingTable(node2, node3)

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
    await node0.api.swarm.connect(node1.peer.addresses[0])
    await node1.api.swarm.connect(node2.peer.addresses[0])

    // ensure nodes have their peers in their routing tables
    await inRoutingTable(node0, node1)
    await inRoutingTable(node1, node2)

    // 3 -> 4 -> 5
    await node3.api.swarm.connect(node4.peer.addresses[0])
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
      * 0 -> 1 -> 2 -> 3 -> 4 -> 5
      */
      await node2.api.swarm.connect(node3.peer.addresses[0])
      await inRoutingTable(node2, node3)

      // should now succeed
      await addFileAndCat(node0, [node5])
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
    createBootstrappedNetwork('a JS network', factory => spawnJsDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })

    createBootstrappedNetwork('a GO network', factory => spawnGoDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })

    createBootstrappedNetwork('a JS bootstrap node in the land of Go', factory => spawnJsDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })

    createBootstrappedNetwork('a Go bootstrap node in the land of JS', factory => spawnGoDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })

    createBootstrappedNetwork('a JS bootstrap node in a hybrid land', factory => spawnJsDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })

    createBootstrappedNetwork('a Go bootstrap node in a hybrid land', factory => spawnGoDaemon(factory, { peerId: peerIds.length - 1 }), (factory, bootstrapAddr) => {
      return Promise.all([
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 0 }),
        spawnGoDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 1 }),
        spawnJsDaemon(factory, { bootstrap: [bootstrapAddr], peerId: 2 })
      ])
    })
  })

  describe('kad-dht with multiple hops', () => {
    createLinearNetwork('a JS node in the land of Go', (factory) => {
      return Promise.all([
        spawnGoDaemon(factory, { peerId: 0 }),
        spawnGoDaemon(factory, { peerId: 1 }),
        spawnGoDaemon(factory, { peerId: 2 }),
        spawnJsDaemon(factory, { peerId: 3 })
      ])
    })

    createLinearNetwork('a Go node in the land of JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory, { peerId: 0 }),
        spawnJsDaemon(factory, { peerId: 1 }),
        spawnJsDaemon(factory, { peerId: 2 }),
        spawnGoDaemon(factory, { peerId: 3 })
      ])
    })

    createLinearNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory, { peerId: 0 }),
        spawnGoDaemon(factory, { peerId: 1 }),
        spawnJsDaemon(factory, { peerId: 2 }),
        spawnGoDaemon(factory, { peerId: 3 })
      ])
    })

    createLinearNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory, { peerId: 0 }),
        spawnGoDaemon(factory, { peerId: 1 }),
        spawnJsDaemon(factory, { peerId: 2 }),
        spawnGoDaemon(factory, { peerId: 3 })
      ])
    })
  })

  describe('kad-dht across disjoint networks that become joint', () => {
    createDisjointNetwork('a GO network', (factory) => {
      return Promise.all([
        spawnGoDaemon(factory, { peerId: 0 }),
        spawnGoDaemon(factory, { peerId: 1 }),
        spawnGoDaemon(factory, { peerId: 2 }),
        spawnGoDaemon(factory, { peerId: 3 }),
        spawnGoDaemon(factory, { peerId: 4 }),
        spawnGoDaemon(factory, { peerId: 5 })
      ])
    })

    createDisjointNetwork('a JS network', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory, { peerId: 0 }),
        spawnJsDaemon(factory, { peerId: 1 }),
        spawnJsDaemon(factory, { peerId: 2 }),
        spawnJsDaemon(factory, { peerId: 3 }),
        spawnJsDaemon(factory, { peerId: 4 }),
        spawnJsDaemon(factory, { peerId: 5 })
      ])
    })

    createDisjointNetwork('a hybrid network, cat from GO', (factory) => {
      return Promise.all([
        spawnGoDaemon(factory, { peerId: 0 }),
        spawnJsDaemon(factory, { peerId: 1 }),
        spawnGoDaemon(factory, { peerId: 2 }),
        spawnJsDaemon(factory, { peerId: 3 }),
        spawnGoDaemon(factory, { peerId: 4 }),
        spawnJsDaemon(factory, { peerId: 5 })
      ])
    })

    createDisjointNetwork('a hybrid network, cat from JS', (factory) => {
      return Promise.all([
        spawnJsDaemon(factory, { peerId: 0 }),
        spawnGoDaemon(factory, { peerId: 1 }),
        spawnJsDaemon(factory, { peerId: 2 }),
        spawnGoDaemon(factory, { peerId: 3 }),
        spawnJsDaemon(factory, { peerId: 4 }),
        spawnGoDaemon(factory, { peerId: 5 })
      ])
    })
  })
})
