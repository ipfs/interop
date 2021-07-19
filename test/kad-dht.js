/* eslint-env mocha */
'use strict'

const randomBytes = require('iso-random-stream/src/random')
const concat = require('it-concat')
const { expect } = require('aegir/utils/chai')
const daemonFactory = require('./utils/daemon-factory')

describe.skip('kad-dht', () => {
  describe('a JS node in the land of Go', () => {
    let jsD
    let goD1
    let goD2
    let goD3

    before(async () => {
      [goD1, goD2, goD3, jsD] = await Promise.all([
        daemonFactory.spawn({ type: 'go' }),
        daemonFactory.spawn({ type: 'go' }),
        daemonFactory.spawn({ type: 'go' }),
        daemonFactory.spawn({ type: 'js' })
      ])
    })

    after(() => daemonFactory.clean())

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
