/* eslint-env mocha */
'use strict'

const { nanoid } = require('nanoid')
const concat = require('it-concat')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')
const uint8ArrayFromString = require('uint8arrays/from-string')

describe('CID version agnostic', function () {
  this.timeout(50 * 1000)
  const daemons = {}

  before(async function () {
    const [js0, js1, go0, go1] = await Promise.all([
      daemonFactory.spawn({ type: 'js' }),
      daemonFactory.spawn({ type: 'js' }),
      daemonFactory.spawn({ type: 'go' }),
      daemonFactory.spawn({ type: 'go' })
    ])
    Object.assign(daemons, { js0, js1, go0, go1 })

    await Promise.all([
      js0.api.swarm.connect(js1.api.peerId.addresses[0]),
      js1.api.swarm.connect(js0.api.peerId.addresses[0]),
      go0.api.swarm.connect(go1.api.peerId.addresses[0]),
      go1.api.swarm.connect(go0.api.peerId.addresses[0]),
      js0.api.swarm.connect(go0.api.peerId.addresses[0]),
      go0.api.swarm.connect(js0.api.peerId.addresses[0])
    ])
  })

  after(() => daemonFactory)

  it('should add v0 and cat v1 (go0 -> go0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.go0.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> js0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.js0.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (go0 -> go1)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.go1.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> js1)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.js1.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (js0 -> go0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.go0.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v0 and cat v1 (go0 -> js0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 0 })
    const cidv1 = cid.toV1()
    const output = await concat(daemons.js0.api.cat(cidv1))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> go0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.go0.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> js0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.js0.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> go1)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.go1.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> js1)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.js1.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (js0 -> go0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.js0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.go0.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })

  it('should add v1 and cat v0 (go0 -> js0)', async () => {
    const input = uint8ArrayFromString(nanoid())
    const { cid } = await daemons.go0.api.add(input, { cidVersion: 1, rawLeaves: false })
    const cidv0 = cid.toV0()
    const output = await concat(daemons.js0.api.cat(cidv0))
    expect(output.slice()).to.deep.equal(input)
  })
})
