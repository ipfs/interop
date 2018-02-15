// Bit of test cases for testing stuff with a internal DSL rather than imperative code

const assert = require('assert')
const DaemonFactory = require('ipfsd-ctl')

// This is what an actual test case looks like
const combinations = ['go', 'js']

test('send and receive pubsub message', combinations, (done, nodes) => {
  const nodeA = nodes[0]
  const nodeB = nodes[0]

  const msg = createMessage()

  nodeA.subscribe(done)
  nodeB.publish(msg)
}, assertRightMessage)
// End of test case

// Code below here wouldn't actually be written in the tests like this, but
// put away in it's own file

// Assertion function for making sure we're getting the right message
function assertRightMessage (nodes, msg) {
  assert.strictEqual(msg.data.toString(), 'hello world')
  assert.strictEqual(msg.topicIDs.length, 1)
  assert.strictEqual(msg.topicIDs[0], nodes[0].getPubsubTopic())
  console.log('Made assertions')
}

// Abstracted data structure for pubsub messages
function createMessage () {
  return Buffer.from('hello world')
}

// Creates a node of a specific type
function createNode (type) {
  return new Promise((resolve, reject) => {
    DaemonFactory.create({
      type: type,
      disposable: true
    }).spawn({
      args: ['--enable-pubsub-experiment']
    }, (err, res) => {
      if (err) return reject(err)
      resolve(res)
    })
  })
}

// creates a testing api for a node
// here we can do things like generate a special pubsub topic per node
function makeNodeInterface (node) {
  const isolatedPubsubTopic = 'randomtest'
  let publishInterval
  return {
    // This could be used by other nodes to make sure we're getting the right topic
    getPubsubTopic: function () {
      return isolatedPubsubTopic
    },
    subscribe: function (assertion) {
      return node.api.pubsub.subscribe(isolatedPubsubTopic, function () {
        clearInterval(publishInterval)
        assertion(...arguments)
      })
    },
    publish: function (msg) {
      // We put this under a loop because we might have sent the message before
      // the subscription was really setup. We should do this with functions
      // that might be called before a condition is what we want it to be
      publishInterval = setInterval(() => {
        console.log('publishing message')
        node.api.pubsub.publish(isolatedPubsubTopic, msg)
      }, 500)
    },
    stop: function () {
      return node.stop()
    }
  }
}

// Creates a node, adds the testing interface and returns it
async function getNode (type) {
  return makeNodeInterface(await createNode(type))
}

// test(testName, combinations, arrangeFunc, assertFunc)
//
// testName is just visual, prints the title + current combination
//
// combinations is a array of implementations to test
//
// arrangeFunc sets up the test and does everything needed to get the data which
// we can assert on
//
// assertFunc gets called after tests to make assertions on the data from the
// arrangeFunc. Should be able to handle arrays as well
async function test (title, combs, arrangeFunc, assertFunc) {
  const cases = []
  // This is a horrible way of generating the cases, but is what I could come
  // up with quickly
  cases.push([combs[0], combs[0]])
  cases.push([combs[1], combs[1]])
  cases.push([combs[0], combs[1]])
  cases.push([combs[1], combs[0]])

  for (const c of cases) {
    const wantedNodeA = c[0]
    const wantedNodeB = c[1]
    console.log(`## ${title} - ${wantedNodeA} <> ${wantedNodeB}`)
    const nodeA = await getNode(wantedNodeA)
    const nodeB = await getNode(wantedNodeB)

    const nodes = [nodeA, nodeB]

    // Wrap the test in a promise, because tests are not always finished when
    // we've run all the top level statements. For example, pubsub tests are
    // finished when we received a message. DHT tests are finished once we've
    // got a reply to a query
    const done = new Promise((resolve) => {
      // Call the arrangeFunc to "arrange" the test
      arrangeFunc((res) => {
        // When test is signaling it's done, run assert function
        assertFunc(nodes, res)
        // Once assertions are done, tests are done
        resolve()
      }, nodes)
    })
    // Wait for tests to finish
    await done
    // Good'ol cleanup
    await nodeA.stop()
    await nodeB.stop()
  }
}
