'use strict'

const webpack = require('webpack')
const createServer = require('ipfsd-ctl').createServer
const signaler = require('libp2p-webrtc-star/src/sig-server')

let signalingServer
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
        signalingServer = await signaler.start({
          port: 24642,
          host: '0.0.0.0',
          metrics: false
        })
      },
      post: async () => {
        await server.stop()
        await signalingServer.stop()
      }
    }
  }
}
