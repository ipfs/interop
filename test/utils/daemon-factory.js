'use strict'

const { createFactory } = require('ipfsd-ctl')
const isNode = require('detect-node')

let ipfsHttpModule
let ipfsModule
try {
  ipfsHttpModule = require(process.env.IPFS_JS_HTTP_MODULE)
} catch {
  ipfsHttpModule = require('ipfs-http-client')
}

try {
  ipfsModule = require(process.env.IPFS_JS_MODULE)
} catch (err) {
  ipfsModule = require('ipfs')
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
