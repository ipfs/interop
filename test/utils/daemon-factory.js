'use strict'
const { createFactory } = require('ipfsd-ctl')
const merge = require('merge-options')

const factory = (options, overrides) => createFactory(
  merge({
    test: true,
    ipfsModule: process.env.IPFS_JS_MODULE
      ? { path: require.resolve(process.env.IPFS_JS_MODULE), ref: require(process.env.IPFS_JS_MODULE) }
      : { path: require.resolve('ipfs'), ref: require('ipfs') },
    ipfsHttpModule: {
      path: require.resolve('ipfs-http-client'),
      ref: require('ipfs-http-client')
    }
  }, options),
  merge({
    js: { ipfsBin: process.env.IPFS_JS_EXEC }
  }, overrides)
)

exports.goDaemonFactory = factory({ type: 'go' })
exports.jsDaemonFactory = factory({ type: 'js' })
exports.jsInProcessDaemonFactory = factory({ type: 'proc' })
