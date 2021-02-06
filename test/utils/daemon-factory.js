'use strict'

const { createFactory } = require('ipfsd-ctl')
const isNode = require('detect-node')
const ipfsModule = require('ipfs')
const ipfsHttpModule = require('ipfs-http-client')

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
