'use strict'

const { createFactory } = require('ipfsd-ctl')
const isNode = require('detect-node')
let IPFS

// webpack requires conditional includes to be done this way
if (process.env.IPFS_JS_MODULE) {
  IPFS = require(process.env.IPFS_JS_MODULE)
} else {
  IPFS = require('ipfs')
}

module.exports = createFactory({
  type: 'go',
  test: true,
  ipfsHttpModule: require('ipfs-http-client')
}, {
  proc: {
    ipfsModule: IPFS
  },
  js: {
    ipfsBin: isNode ? process.env.IPFS_JS_EXEC || require.resolve(`${process.env.IPFS_JS_MODULE || 'ipfs'}/src/cli/bin.js`) : undefined
  },
  go: {
    ipfsBin: isNode ? process.env.IPFS_GO_EXEC || require('go-ipfs-dep').path.silent() : undefined
  }
})
