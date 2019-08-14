/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const hat = require('hat')
const CID = require('cids')
const {
  spawnInitAndStartGoDaemon,
  spawnInitAndStartJsDaemon,
  stopDaemon
} = require('./utils/daemon')

describe('CID version agnostic', () => {
  const daemons = {}

  before(async function () {
    this.timeout(50 * 1000)

    const [js0, js1, go0, go1] = await Promise.all([
      spawnInitAndStartJsDaemon(),
      spawnInitAndStartJsDaemon(),
      spawnInitAndStartGoDaemon(),
      spawnInitAndStartGoDaemon()
    ])
    Object.assign(daemons, { js0, js1, go0, go1 })

    // Get peer IDs
    await Promise.all(Object.keys(daemons).map(async k => {
      daemons[k].peerId = await daemons[k].api.id()
    }))

    await Promise.all([
      js0.api.swarm.connect(js1.peerId.addresses[0]),
      js1.api.swarm.connect(js0.peerId.addresses[0]),
      go0.api.swarm.connect(go1.peerId.addresses[0]),
      go1.api.swarm.connect(go0.peerId.addresses[0]),
      js0.api.swarm.connect(go0.peerId.addresses[0]),
      go0.api.swarm.connect(js0.peerId.addresses[0])
    ])
  })

  after(function () {
    this.timeout(30 * 1000)
    return Promise.all(Object.values(daemons).map(stopDaemon))
  })

  it('should add v0 and cat v1 (go0 -> go0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.go0.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> js0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.js0.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (go0 -> go1)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.go1.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> js1)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.js1.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> go0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.go0.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (go0 -> js0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = new CID(res[0].hash).toV1()
    const output = await daemons.js0.api.cat(cidv1)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> go0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.go0.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> js0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.js0.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> go1)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.go1.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> js1)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.js1.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> go0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.go0.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> js0)', async () => {
    const input = Buffer.from(hat())
    const res = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = new CID(res[0].hash).toV0()
    const output = await daemons.js0.api.cat(cidv0)
    expect(output).to.deep.equal(input)
  })
})
