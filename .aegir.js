'use strict'

const webpack = require('webpack')
const createServer = require('ipfsd-ctl').createServer
const signaler = require('libp2p-webrtc-star/src/sig-server')
const findBin = require('./test/utils/find-bin')

let signalingServer
let goIpfsdServer
let jsIpfsdServer

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
        goIpfsdServer = await createServer({
          host: '127.0.0.1',
          port: 43134
        }, {
          type: 'go',
          test: true,
          ipfsHttpModule: {
            path: require.resolve('ipfs-http-client'),
            ref: require('ipfs-http-client')
          }
        }, {
          go: { ipfsBin: findBin('go') }
        }).start()

        jsIpfsdServer = await createServer({
          host: '127.0.0.1',
          port: 43135
        }, {
          type: 'js',
          test: true,
          ipfsModule: {
            path: require.resolve(process.env.IPFS_JS_MODULE || 'ipfs'),
            ref: require(process.env.IPFS_JS_MODULE || 'ipfs')
          },
          ipfsHttpModule: {
            path: require.resolve('ipfs-http-client'),
            ref: require('ipfs-http-client')
          },
          ipfsOptions: {
            config: {
              libp2p: {
                dialer: {
                  dialTimeout: 60e3 // increase timeout because travis is slow
                }
              }
            }
          }
        }, {
          js: { ipfsBin: findBin('js') }
        }).start()

        signalingServer = await signaler.start({
          port: 24642,
          host: '0.0.0.0',
          metrics: false
        })
      },
      post: async () => {
        await goIpfsdServer.stop()
        await jsIpfsdServer.stop()
        await signalingServer.stop()
      }
    }
  }
}
