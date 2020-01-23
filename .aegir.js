'use strict'

const webpack = require('webpack')
const createServer = require('ipfsd-ctl').createServer
const rendezvous = require('libp2p-websocket-star-rendezvous')

let rzserver
const server = createServer()
module.exports = {
  webpack: {
    plugins: [
      new webpack.EnvironmentPlugin(['IPFS_JS_EXEC', 'IPFS_JS_MODULE'])
    ]
  },
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
        rzserver =  await rendezvous.start({
          port: 24642
        })
      },
      post: async () => {
        await server.stop()
        await rzserver.stop()
      }
    }
  }
}
