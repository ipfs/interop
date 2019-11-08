/* eslint-env mocha */
'use strict'

const crypto = require('crypto')
const bl = require('bl')
const { expect } = require('./utils/chai')

const { spawnGoDaemon, spawnJsDaemon } = require('./utils/daemon')

describe.skip('kad-dht', () => {
  describe('a JS node in the land of Go', () => {
    let jsD
    let goD1
    let goD2
    let goD3

    before(async () => {
      [goD1, goD2, goD3, jsD] = await Promise.all([
        spawnGoDaemon({ initOptions: { bits: 1024 } }),
        spawnGoDaemon({ initOptions: { bits: 1024 } }),
        spawnGoDaemon({ initOptions: { bits: 1024 } }),
        spawnJsDaemon({ initOptions: { bits: 512 } })
      ])
    })

    after(() => {
      return Promise.all([goD1, goD2, goD3, jsD].map((node) => node.stop()))
    })

    it('make connections', async () => {
      const ids = await Promise.all([
        jsD.api.id(),
        goD1.api.id(),
        goD2.api.id(),
        goD3.api.id()
      ])

      await Promise.all([
        jsD.api.swarm.connect(ids[1].addresses[0]),
        goD1.api.swarm.connect(ids[2].addresses[0]),
        goD2.api.swarm.connect(ids[3].addresses[0])
      ])
    })

    it('one hop', async () => {
      const data = crypto.randomBytes(9001)

      const res = await goD1.api.add(data)
      const stream = await jsD.api.cat(res[0].hash)
      const file = await new Promise((resolve, reject) => {
        stream.pipe(bl((err, file) => err ? reject(err) : resolve(file)))
      })

      expect(file).to.be.eql(data)
    })

    it('two hops', async () => {
      const data = crypto.randomBytes(9001)

      const res = await goD2.api.add(data)
      const stream = await jsD.api.cat(res[0].hash)
      const file = await new Promise((resolve, reject) => {
        stream.pipe(bl((err, file) => err ? reject(err) : resolve(file)))
      })

      expect(file).to.be.eql(data)
    })

    it('three hops', async () => {
      const data = crypto.randomBytes(9001)

      const res = await goD3.api.add(data)
      const stream = await jsD.api.cat(res[0].hash)
      const file = await new Promise((resolve, reject) => {
        stream.pipe(bl((err, file) => err ? reject(err) : resolve(file)))
      })

      expect(file).to.be.eql(data)
    })
  })

  describe('a Go node in the land of JS', () => {})
  describe('hybrid', () => {})
})
