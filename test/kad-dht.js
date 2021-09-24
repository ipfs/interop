/* eslint-env mocha */

import randomBytes from 'iso-random-stream/src/random.js'
import concat from 'it-concat'
import { expect } from 'aegir/utils/chai.js'
import { daemonFactory } from './utils/daemon-factory.js'

describe.skip('kad-dht', () => {
  let factory

  before(async () => {
    factory = await daemonFactory()
  })

  after(() => factory.clean())

  describe('a JS node in the land of Go', () => {
    let jsD
    let goD1
    let goD2
    let goD3

    before(async () => {
      [goD1, goD2, goD3, jsD] = await Promise.all([
        factory.spawn({ type: 'go' }),
        factory.spawn({ type: 'go' }),
        factory.spawn({ type: 'go' }),
        factory.spawn({ type: 'js' })
      ])
    })

    after(() => factory.clean())

    it('make connections', async () => {
      await Promise.all([
        jsD.api.swarm.connect(goD1.api.peerId.addresses[0]),
        goD1.api.swarm.connect(goD2.api.peerId.addresses[0]),
        goD2.api.swarm.connect(goD3.api.peerId.addresses[0])
      ])
    })

    it('one hop', async () => {
      const data = randomBytes(9001)

      const { cid } = await goD1.api.add(data)
      const file = await concat(jsD.api.cat(cid))

      expect(file.slice()).to.be.eql(data)
    })

    it('two hops', async () => {
      const data = randomBytes(9001)

      const { cid } = await goD2.api.add(data)
      const file = await concat(jsD.api.cat(cid))

      expect(file.slice()).to.be.eql(data)
    })

    it('three hops', async () => {
      const data = randomBytes(9001)

      const { cid } = await goD3.api.add(data)
      const file = await concat(jsD.api.cat(cid))

      expect(file.slice()).to.be.eql(data)
    })
  })

  describe('a Go node in the land of JS', () => {})
  describe('hybrid', () => {})
})
