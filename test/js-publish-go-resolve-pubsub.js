/* eslint-env mocha */
"use strict";

const { fromB58String } = require("multihashes");
const base64url = require("base64url");
const ipns = require("ipns");
const delay = require("delay");
const last = require("it-last");
const pRetry = require("p-retry");
const waitFor = require("./utils/wait-for");
const { expect } = require("./utils/chai");
const daemonFactory = require("./utils/daemon-factory");

const retryOptions = {
  retries: 5,
};

const namespace = "/record/";

const ipfsRef = "/ipfs/QmPFVLPmp9zv5Z5KUqLhe2EivAGccQW2r7M7jhVJGLZoZU";

const KEY_NAME = "imported-key";

describe("ipns-pubsub", function () {
  this.timeout(350 * 1000);
  let nodes = [];

  // Spawn daemons
  before(async function () {
    nodes = await Promise.all([
      // 0
      daemonFactory.spawn({
        type: "go",
        test: true,
        args: ["--enable-namesys-pubsub"],
      }),
      // 1
      daemonFactory.spawn({
        type: "js",
        test: true,
        args: ["--enable-namesys-pubsub", `--pass=passwordtoyourmother`],
      }),
      // 2
      // go-ipfs needs two nodes in the DHT to be able to publish a record
      // TODO: Remove this when js-ipfs has a DHT
      daemonFactory.spawn({
        type: "go",
        test: true,
        args: ["--enable-namesys-pubsub"],
      }),
    ]);
  });

  // Connect nodes and wait for republish
  before(async function () {
    await nodes[0].api.swarm.connect(nodes[1].api.peerId.addresses[0]);

    // go-ipfs needs two nodes in the DHT to be able to publish a record
    // TODO: Remove this when js-ipfs has a DHT
    await nodes[0].api.swarm.connect(nodes[2].api.peerId.addresses[0]);

    console.log(
      "wait to republish as we can receive the republish message first"
    ); // eslint-disable-line
    await delay(60000);
  });

  after(() => daemonFactory.clean());

  it("should get enabled state of pubsub", async function () {
    for (const node of nodes) {
      const state = await node.api.name.pubsub.state();
      expect(state).to.exist();
      expect(state.enabled).to.equal(true);
    }
  });

  it("should publish the received record to a go node and a js subscriber should receive it", async function () {
    this.timeout(300 * 1000);
    // TODO find out why JS doesn't resolve, might be just missing a DHT
    await expect(
      last(nodes[1].api.name.resolve(nodes[0].api.peerId.id, { stream: false }))
    ).to.eventually.be.rejected.with(/was not found in the network/);
    await subscribeToReceiveByPubsub(
      nodes[0],
      nodes[1],
      nodes[0].api.peerId.id,
      nodes[1].api.peerId.id
    );
  });

  it("should be initially one (1) record on the list: self", async function () {
    this.timeout(350 * 1000);

    // self should be the one and only before the resolve
    expect((await nodes[0].api.pubsub.ls()).length).to.equal(1);
    expect(await nodes[0].api.pubsub.ls())
      .to.be.an("array")
      .that.includes(
        `${namespace}${base64url.encode(
          ipns
            .getIdKeys(await fromB58String(nodes[0].api.peerId.id))
            .routingKey.toBuffer()
        )}`
      );
    expect((await nodes[0].api.name.pubsub.subs()).length).to.equal(1);
    expect(await nodes[0].api.name.pubsub.subs())
      .to.be.an("array")
      .that.includes(`/ipns/` + nodes[0].api.peerId.id);
  });

  it("should initially resolve successfully", async function () {
    await last(
      nodes[0].api.name.resolve(nodes[1].api.peerId.id, { stream: false })
    );
  });

  it("should increment the pubsub record array by 1, and include newly resolved key", async function () {
    this.timeout(350 * 1000);

    let regPubSubGo = await nodes[0].api.pubsub.ls();
    let namePubSubGo = await nodes[0].api.name.pubsub.subs();

    // after initial resolve, now 2 in the array and with one belonging to the new one
    expect(regPubSubGo.length).to.equal(2);
    expect(regPubSubGo)
      .to.be.an("array")
      .that.includes(
        `${namespace}${base64url.encode(
          ipns
            .getIdKeys(await fromB58String(nodes[1].api.peerId.id))
            .routingKey.toBuffer()
        )}`
      );
    expect(namePubSubGo.length).to.equal(2);
    expect(namePubSubGo)
      .to.be.an("array")
      .that.includes(`/ipns/` + nodes[1].api.peerId.id);
  });

  it("should publish and resolve a pubsub record array and include newly resolved 'self' key", async function () {
    this.timeout(350 * 1000);

    await subscribeToReceiveByPubsub(
      nodes[1],
      nodes[0],
      nodes[1].api.peerId.id,
      nodes[0].api.peerId.id
    );
  });

  it("should resolve the imported key on the go subscriber", async function () {
    this.timeout(350 * 1000);

    // import the key onto JS keychain
    await createKey(nodes[1].api, KEY_NAME);
    let r = await nodes[1].api.key.list();
    let key = r.find((k) => k.name == KEY_NAME);

    // TODO: find out why go-ipfs doesn't resolve an imported key
    /**
     * This test fails. Go-ipfs does not resolve the imported key.id
     */
    await last(nodes[0].api.name.resolve(key.id, { stream: false }));
    // eventually.rejects.with(/HTTPError: routing: not found/);
  });

  /**
   * After resolve, now 3 should be in the arrays and the last belongs to the resolved node
   * These tests also fail. Go-ipfs is not adding the /ipns/ record when resolve(key.id) is used, where key.id != 'self'
   */
  it("should increment the pubsub records on the go subscriber", async function () {
    this.timeout(350 * 1000);

    let regPubSubGo = await nodes[0].api.pubsub.ls();
    let namePubSubGo = await nodes[0].api.name.pubsub.subs();

    expect(namePubSubGo.length).to.equal(3);
    expect(namePubSubGo)
      .to.be.an("array")
      .that.includes(`/ipns/` + key.id);

    expect(regPubSubGo.length).to.equal(3);
    expect(regPubSubGo)
      .to.be.an("array")
      .that.includes(
        `${namespace}${base64url.encode(
          ipns.getIdKeys(await fromB58String(key.id)).routingKey.toBuffer()
        )}`
      );
  });

  /**
   * Subscribe fails since there is no /ipns/ record on the go-ipfs node
   */
  it("should resolve the published record on the go subscriber", async function () {
    this.timeout(350 * 1000);

    await subscribeToReceiveByPubsub(
      nodes[1],
      nodes[0],
      nodes[1].api.peerId.id,
      nodes[0].api.peerId.id,
      KEY_NAME
    );
  });
});
//  * IPNS resolve subscription test
//  * 1) name.resolve() , which subscribes the topic
//  * 2) wait to guarantee the subscription
//  * 3) subscribe again just to know until when to wait (inside the scope of the test)
//  * 4) wait for the other peer to get notified of the subscription
//  * 5) publish new ipns record
//  * 6) wait until the record is received in the test scope subscribe
//  * 7) resolve ipns record
const subscribeToReceiveByPubsub = async (
  nodeA,
  nodeB,
  idA,
  idB,
  keyName = "self"
) => {
  let subscribed = false;
  function checkMessage(msg) {
    subscribed = true;
  }

  let keyId = idA; // default to self, which means key is node peerId
  if (keyName != "self") {
    let r = await nodeA.api.key.list();
    let key = r.find((k) => k.name == keyName);
    keyId = key.id; //switch out peerId for key.id of the imported ipns key
  }

  const keys = ipns.getIdKeys(fromB58String(keyId));
  const topic = `${namespace}${base64url.encode(keys.routingKey.toBuffer())}`;

  await waitForPeerToSubscribe(nodeB.api, topic);
  await nodeB.api.pubsub.subscribe(topic, checkMessage);
  await waitForNotificationOfSubscription(nodeA.api, topic, idB);
  const res1 = await nodeA.api.name.publish(ipfsRef, {
    resolve: false,
    key: keyName,
  });
  await waitFor(() => subscribed === true, 50 * 1000);
  const res2 = await last(nodeB.api.name.resolve(keyId));

  expect(res1.name).to.equal(keyId); // Published to Node A ID
  expect(res2).to.equal(ipfsRef);
};

// wait until a peer know about other peer to subscribe a topic
const waitForNotificationOfSubscription = (daemon, topic, peerId) =>
  pRetry(async () => {
    const res = await daemon.pubsub.peers(topic);

    if (!res || !res.length || !res.includes(peerId)) {
      throw new Error("Could not find peer subscribing");
    }
  }, retryOptions);

// Wait until a peer subscribes a topic
const waitForPeerToSubscribe = async (daemon, topic) => {
  await pRetry(async () => {
    const res = await daemon.pubsub.ls();

    if (!res || !res.length || !res.includes(topic)) {
      throw new Error("Could not find subscription");
    }

    return res[0];
  }, retryOptions);
};

async function createKey(ipfsBrowser, keyName) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!(await ipfsBrowser.key.list()).find((k) => k.name == keyName))
        await ipfsBrowser.key.gen(keyName);

      // key can now be used to publish to this ipns publicKey
      resolve(true);
    } catch (err) {
      console.log(`Error importing key ${keyName}: \n ${err}`);
      reject(false);
    }
  });
}
