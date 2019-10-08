'use strict'

const createServer = require('ipfsd-ctl').createServer
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
        const res = await Promise.all([
          server.start(),
          rendezvous.start({ port: 24642 })
        ])

        rzserver = res[1]
      },
      post: () => Promise.all([
        server.stop(),
        rzserver.stop()
      ])
    }
  }
}
