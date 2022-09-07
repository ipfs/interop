/* eslint-env mocha */

import { nanoid } from 'nanoid'
import concat from 'it-concat'
import { expect } from 'aegir/utils/chai.js'
import { daemonFactory } from './utils/daemon-factory.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

describe('CID version agnostic', function () {
  this.timeout(50 * 1000)
  const daemons = {}
  let factory

  before(async function () {
    factory = await daemonFactory()

    const [js0, js1, go0, go1] = await Promise.all([
      factory.spawn({ type: 'js' }),
      factory.spawn({ type: 'js' }),
      factory.spawn({ type: 'go' }),
      factory.spawn({ type: 'go' })
    ])
    Object.assign(daemons, { js0, js1, go0, go1 })

    await Promise.all([
      js0.api.swarm.connect(js1.peer.addresses[0]),
      js1.api.swarm.connect(js0.peer.addresses[0]),
      go0.api.swarm.connect(go1.peer.addresses[0]),
      go1.api.swarm.connect(go0.peer.addresses[0]),
      js0.api.swarm.connect(go0.peer.addresses[0]),
      go0.api.swarm.connect(js0.peer.addresses[0])
    ])
  })

  after(() => factory.clean())

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
