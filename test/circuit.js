/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const parallel = require('async/parallel')

const isNode = require('detect-node')
const utils = require('./utils/circuit')

const proc = utils.setUpProcNode
const js = utils.setUpJsNode
const go = utils.setUpGoNode

const ws = utils.wsAddr
const star = utils.wsStarAddr
const circuit = utils.circuitAddr

const create = utils.create
const connect = utils.connect
const send = utils.send

const base = '/ip4/127.0.0.1/tcp'

// TODO: (dryajov) circuit tests ended up being
// more complex than expected, the majority
// of the complexity comes from spawning and
// connecting the nodes.
//
// I've come up with this little DSL to avoid
// duplicating code all over the place. Some
// notable quirks that lead to this:
//
// - ipfs-api connect, doesn't support peer ids,
// only plain addresses, hence we end up filtering
// addresses (clunky)
// - not all connect sequences work in all cases
//   - i.e. cant connect to browser relays since
//     go doesn't support the star protos, so the
//     sequence has to be changed to connect the
//     browser relay to the nodes instead
//
// that breaks the flow and also any attempt to
// generalize and abstract things out

/**
 * Legend:
 * - `name`     - the name of the test
 * - `nodes`    - object containing the nodes to spawn
 *  - `key`     - the key of the object is the name
 *  - `exec`    - the method used to spawn the node, there are tree `js`, `go` and `proc`
 *  - `addrs`   - the address to spawn the node with
 * - `connect`  - array of arrays describing how to connect the nodes, reads from left to right
 *                the first element connects to the second. A tuple contains objects of the for of
 *                [{name: 'node1', parser: js}, {name: 'relay'}]
 *  - `name`    - the name of the node
 *  - `parser`  - the parsing function used to extract the address
 * - `send`     - array describing the direction in which to send the data
 *                ['node1', 'node2'] send from node1 to node2
 *
 *
 *  {
 *   name: 'go-go-go',           // name of the test, what shows in the describe
 *   nodes: {                    // describes the nodes section
 *     node1: {                  // name of the node
 *       exec: go,               // the function to create the nodes
 *       addrs: [`${base}/0/ws`] // address of the node
 *     },
 *     relay: {
 *       exec: go,
 *       addrs: [`${base}/0/ws`]
 *     },
 *     node2: {
 *       exec: go,
 *       addrs: [`${base}/0/ws`]
 *     }
 *   },
 *   connect: [                                                // describes how to connect the nodes
 *     [{ name: 'node1', parser: ws }, { name: 'relay' }],     // connect node1 to relay use ws parser to filter the address
 *     [{ name: 'node2', parser: ws }, { name: 'relay' }],     // connect node2 to relay use ws parser to filter the address
 *     [{ name: 'node1', parser: circuit }, { name: 'node2' }] // connect node1 to node2 use circuit parser to filter the address
 *    ],
 *    send: ['node1', 'node2'] // describe the direction which data is sent - node1 to node2
 *    skip: () => true         // method called to determine if the tests should be skipped
 *  }
 */

const tests = [
  {
    name: 'go-go-go',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2']
  },
  {
    name: 'js-go-go',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => true
  },
  {
    name: 'js-go-js',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2']
  },
  {
    name: 'js-js-js',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2']
  },
  {
    name: 'js-js-go',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2']
  },
  {
    name: 'go-js-go',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2']
  },
  {
    name: 'browser-js-go',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-js-js',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'js-js-browser',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'go-js-browser',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-js-browser',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-go-go',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-go-js',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'js-go-browser',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'go-go-browser',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-go-browser',
    nodes: {
      node1: {
        exec: proc,
        addrs: []
      },
      relay: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      node2: {
        exec: proc,
        addrs: []
      }
    },
    connect: [
      [{ name: 'node1', parser: ws }, { name: 'relay' }],
      [{ name: 'node2', parser: ws }, { name: 'relay' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => true
  },
  {
    name: 'go-browser-browser',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`],
        relay: true
      },
      node2: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: star }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'go-browser-js',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: []
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'go-browser-go',
    nodes: {
      node1: {
        exec: go,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: []
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => true
  },
  {
    name: 'js-browser-js',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: []
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'js-browser-go',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: []
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'js-browser-browser',
    nodes: {
      node1: {
        exec: js,
        addrs: [`${base}/0/ws`]
      },
      relay: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      },
      node2: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      }
    },
    connect: [
      [{ name: 'relay', parser: ws }, { name: 'node1' }],
      [{ name: 'relay', parser: star }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-browser-js',
    nodes: {
      node1: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      },
      relay: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      },
      node2: {
        exec: js,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: star }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => isNode
  },
  {
    name: 'browser-browser-go',
    nodes: {
      node1: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      },
      relay: {
        exec: proc,
        addrs: [`/ip4/127.0.0.1/tcp/24642/ws/p2p-websocket-star`]
      },
      node2: {
        exec: go,
        addrs: [`${base}/0/ws`]
      }
    },
    connect: [
      [{ name: 'relay', parser: star }, { name: 'node1' }],
      [{ name: 'relay', parser: ws }, { name: 'node2' }],
      [{ name: 'node1', parser: circuit }, { name: 'node2' }]
    ],
    send: ['node1', 'node2'],
    skip: () => true
  }
]

describe('circuit', () => {
  tests.forEach((test) => {
    let nodes

    const dsc = test.skip && test.skip() ? describe.skip : describe
    dsc(test.name, function () {
      before((done) => {
        create(test.nodes, (err, _nodes) => {
          expect(err).to.not.exist()
          nodes = _nodes
          done()
        })
      })

      after((done) => parallel(nodes.map((node) => (cb) => node.node.ipfsd.stop(cb)), done))

      it('connect', (done) => {
        connect(test.connect, nodes, done)
      })

      it('send', (done) => {
        send(test.send, nodes, done)
      })
    })
  })
})
