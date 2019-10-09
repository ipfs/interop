'use strict'

const createServer = require('ipfsd-ctl').createServer
const parallel = require('async/parallel')
const rendezvous = require('libp2p-websocket-star-rendezvous')

let rzserver

const server = createServer()
module.exports = {
  karma: {
    files: [{
      pattern: 'test/fixtures/**/*',
      watched: false,
      served: true,
      included: false
    }],
    singleRun: true,
    browserNoActivityTimeout: 100 * 1000
  },
  hooks: {
    browser: {
      pre: async () => {
        await server.start()
        return new Promise((resolve, reject) => {
            rendezvous.start({
              port: 24642
            }, (err, _rzserver) => {
              if (err) {
                return reject(err)
              }
              rzserver = _rzserver
              resolve()
            })
        })
      },
      post: async () => {
        await server.stop()

        return new Promise((resolve) => {
          rzserver.stop(resolve)
        })
      }
    }
  }
}
