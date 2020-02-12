'use strict'

const { createFactory } = require('ipfsd-ctl')
const findBin = require('./find-bin')

exports.goDaemonFactory = createFactory({
  type: 'go',
  test: true,
  ipfsHttpModule: {
    path: require.resolve('ipfs-http-client'),
    ref: require('ipfs-http-client')
  }
}, {
  go: { ipfsBin: findBin('go') }
})

exports.jsDaemonFactory = createFactory({
  type: 'js',
  test: true,
  ipfsModule: {
    path: require.resolve(process.env.IPFS_JS_MODULE || 'ipfs'),
    ref: require(process.env.IPFS_JS_MODULE || 'ipfs')
  },
  ipfsHttpModule: {
    path: require.resolve('ipfs-http-client'),
    ref: require('ipfs-http-client')
  }
}, {
  js: { ipfsBin: findBin('js') }
})

exports.jsInProcessDaemonFactory = createFactory({
  type: 'proc',
  test: true,
  ipfsModule: {
    path: require.resolve(process.env.IPFS_JS_MODULE || 'ipfs'),
    ref: require(process.env.IPFS_JS_MODULE || 'ipfs')
  }
})
