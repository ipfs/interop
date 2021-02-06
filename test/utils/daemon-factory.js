'use strict'

const { createFactory } = require('ipfsd-ctl')
const isNode = require('detect-node')

module.exports = createFactory({
  type: 'go',
  test: true,
  ipfsHttpModule: require.resolve(`${process.env.IPFS_JS_HTTP_MODULE}`)
}, {
  proc: {
    ipfsModule: require.resolve(`${process.env.IPFS_JS_MODULE}`)
  },
  js: {
    ipfsBin: isNode ? process.env.IPFS_JS_EXEC || require.resolve(`${process.env.IPFS_JS_MODULE || 'ipfs'}/src/cli.js`) : undefined
  },
  go: {
    ipfsBin: isNode ? process.env.IPFS_GO_EXEC || require('go-ipfs').path() : undefined
  }
})
