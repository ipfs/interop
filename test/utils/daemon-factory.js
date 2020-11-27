'use strict'

const { createFactory } = require('ipfsd-ctl')
const isNode = require('detect-node')
let ipfsModule
let ipfsHttpModule

// webpack requires conditional includes to be done this way
if (process.env.IPFS_JS_MODULE) {
  ipfsModule = require(process.env.IPFS_JS_MODULE)
} else {
  ipfsModule = require('ipfs')
}

if (process.env.IPFS_JS_HTTP_MODULE) {
  ipfsHttpModule = require(process.env.IPFS_JS_HTTP_MODULE)
} else {
  ipfsHttpModule = require('ipfs-http-client')
}

module.exports = createFactory({
  type: 'go',
  test: true,
  ipfsHttpModule
}, {
  proc: {
    ipfsModule
  },
  js: {
    ipfsBin: isNode ? process.env.IPFS_JS_EXEC || require.resolve(`${process.env.IPFS_JS_MODULE || 'ipfs'}/src/cli.js`) : undefined
  },
  go: {
    ipfsBin: isNode ? process.env.IPFS_GO_EXEC || require('go-ipfs').path() : undefined
  }
})
