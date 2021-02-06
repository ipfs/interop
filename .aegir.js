'use strict'

const path = require('path')
const createServer = require('ipfsd-ctl').createServer
const signaler = require('libp2p-webrtc-star/src/sig-server')

let signalingServer
let ipfsdServer

const esbuild = {
  inject: [path.join(__dirname, 'node-globals.js')],
  plugins: [
    {
      name: 'node built ins',
      setup (build) {
        build.onResolve({ filter: /^stream$/ }, () => {
          return { path: require.resolve('readable-stream') }
        })

        build.onResolve({ filter: /^ipfs$/ }, () => {
          return { path: require.resolve(process.env.IPFS_JS_MODULE) || require.resolve('ipfs') }
        })
        build.onResolve({ filter: /^ipfs-http-client$/ }, () => {
          return { path: require.resolve(process.env.IPFS_JS_HTTP_MODULE) || require.resolve('ipfs-http-client') }
        })
      }
    }
  ]
}

module.exports = {
  test: {
    browser :{
      config: {
        buildConfig: esbuild
      }
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
            ipfsBin: process.env.IPFS_GO_EXEC || require('go-ipfs').path()
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
            ipfsBin: process.env.IPFS_JS_EXEC || require.resolve(`${process.env.IPFS_JS_MODULE || 'ipfs'}/src/cli.js`)
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
