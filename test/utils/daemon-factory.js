'use strict'
const { createFactory } = require('ipfsd-ctl')
const merge = require('merge-options')

const factory = (options, overrides) => createFactory(
  merge({
    test: true,
    ipfsModule: {
      path: require.resolve(process.env.IPFS_JS_MODULE || 'ipfs'),
      ref: require(process.env.IPFS_JS_MODULE || 'ipfs')
    },
    ipfsHttpModule: {
      path: require.resolve('ipfs-http-client'),
      ref: require('ipfs-http-client')
    }
  }, options),
  merge({
    js: {
      ipfsBin: './node_modules/.bin/jsipfs'
    }
  }, overrides)
)

exports.goDaemonFactory = factory({ type: 'go' })
exports.jsDaemonFactory = factory({ type: 'js' })
exports.jsInProcessDaemonFactory = factory({ type: 'proc' })
