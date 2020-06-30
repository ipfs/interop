'use strict'

const webpack = require('webpack')
const createServer = require('ipfsd-ctl').createServer
const signaler = require('libp2p-webrtc-star/src/sig-server')

let signalingServer
let ipfsdServer

module.exports = {
  webpack: {
    plugins: [
      new webpack.EnvironmentPlugin(['IPFS_JS_EXEC'])
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
    browserNoActivityTimeout: 100 * 1000,
    webpack: {
      resolve: {
        alias: {
          ipfs$: process.env.IPFS_JS_MODULE || require.resolve('ipfs'),
          'ipfs-http-client$': process.env.IPFS_JS_HTTP_MODULE || require.resolve('ipfs-http-client'),
        }
      },
      plugins: [
        new webpack.DefinePlugin({
          // override js module locations because we override them above
          'process.env.IPFS_JS_MODULE': 'undefined',
          'process.env.IPFS_JS_HTTP_MODULE': 'undefined'
        })
      ]
    }
  },
  hooks: {
    browser: {
      pre: async () => {
        ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: 43134
        }, {
          type: 'go',
          test: true,
          ipfsHttpModule: require(process.env.IPFS_JS_HTTP_MODULE || 'ipfs-http-client')
        }, {
          go: {
            ipfsBin: process.env.IPFS_GO_EXEC || require('go-ipfs-dep').path()
          },
          js: {
            ipfsOptions: {
              config: {
                libp2p: {
                  dialer: {
                    dialTimeout: 60e3 // increase timeout because travis is slow
                  }
                }
              }
            },
            ipfsModule: require(process.env.IPFS_JS_MODULE || 'ipfs'),
            ipfsBin: process.env.IPFS_JS_EXEC || require.resolve(`${process.env.IPFS_JS_MODULE || 'ipfs'}/src/cli/bin.js`)
          }
        }).start()

        signalingServer = await signaler.start({
          port: 24642,
          host: '0.0.0.0',
          metrics: false
        })
      },
      post: async () => {
        await ipfsdServer.stop()
        await signalingServer.stop()
      }
    }
  }
}
