'use strict'

const { createFactory } = require('ipfsd-ctl')

// (Configured in .aegir.js)
exports.goDaemonFactory = createFactory({
  type: 'go',
  test: true,
  remote: true,
  endpoint: 'http://127.0.0.1:43134',
  ipfsHttpModule: {
    path: require.resolve('ipfs-http-client'),
    ref: require('ipfs-http-client')
  }
})

// (Configured in .aegir.js)
exports.jsDaemonFactory = createFactory({
  type: 'js',
  test: true,
  remote: true,
  endpoint: 'http://127.0.0.1:43135',
  ipfsHttpModule: {
    path: require.resolve('ipfs-http-client'),
    ref: require('ipfs-http-client')
  }
})

exports.jsInProcessDaemonFactory = createFactory({
  type: 'proc',
  test: true,
  ipfsModule: process.env.IPFS_JS_MODULE ? {
    path: require.resolve(process.env.IPFS_JS_MODULE),
    ref: require(process.env.IPFS_JS_MODULE)
  } : {
    path: require.resolve('ipfs'),
    ref: require('ipfs')
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
})
