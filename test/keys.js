/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const {
  spawnInitAndStartGoDaemon,
  spawnInitAndStartJsDaemon,
  stopDaemon
} = require('./utils/daemon')
const {
  compare
} = require('./utils/compare')

describe.only('keys', function () {
  this.timeout(50 * 1000)

  let go
  let js

  before(() => {
    return Promise.all([
      spawnInitAndStartGoDaemon(),
      spawnInitAndStartJsDaemon()
    ])
      .then(([goDaemon, jsDaemon]) => {
        go = goDaemon
        js = jsDaemon
      })
  })

  after(() => {
    return Promise.all([
      stopDaemon(go),
      stopDaemon(js)
    ])
  })

  it('lists keys', () => {
    const operation = (daemon) => {
      return daemon.api.key.list()
    }

    return compare(
      // key identities will be different so just compare the names
      operation(go).then(keys => keys.map(key => key.name)),
      operation(js).then(keys => keys.map(key => key.name))
    )
  })

  const keyTypes = [{
    name: 'rsa',
    options: {
      type: 'rsa'
    }
  }, {
    name: 'ed25519',
    options: {
      type: 'ed25519'
    }
  }]

  keyTypes.forEach(type => {
    it(`generates ${type.name} keys`, () => {
      const operation = (daemon) => {
        return daemon.api.key.gen(type.name, type.options)
          .then(() => daemon.api.key.list())
      }

      return compare(
        // key identities will be different so just compare the names
        operation(go).then(keys => keys.map(key => key.name)),
        operation(js).then(keys => keys.map(key => key.name))
      )
    })
  })
})
