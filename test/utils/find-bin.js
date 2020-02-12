'use strict'

const os = require('os')
const resolveCwd = require('resolve-cwd')

module.exports = type => {
  return type === 'js'
    ? process.env.IPFS_JS_EXEC || resolveCwd('ipfs/src/cli/bin.js')
    : process.env.IPFS_GO_EXEC || resolveCwd(`go-ipfs-dep/go-ipfs/ipfs${os.platform() === 'win32' ? '.exe' : ''}`)
}
