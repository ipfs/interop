
import { createFactory } from 'ipfsd-ctl'
import isNode from 'detect-node'

export async function daemonFactory () {
  let ipfsHttpModule
  let ipfsModule
  let goIpfsModule

  try {
    ipfsHttpModule = await import(process.env.IPFS_JS_HTTP_MODULE)
  } catch {
    ipfsHttpModule = await import('ipfs-http-client')
  }

  try {
    ipfsModule = await import(process.env.IPFS_JS_MODULE)
  } catch {
    ipfsModule = await import('ipfs')
  }

  try {
    goIpfsModule = await import(process.env.IPFS_GO_IPFS_MODULE)
  } catch {
    goIpfsModule = await import('go-ipfs')
  }

  return createFactory({
    type: 'go',
    test: true,
    ipfsHttpModule
  }, {
    proc: {
      ipfsModule
    },
    js: {
      ipfsBin: isNode ? process.env.IPFS_JS_EXEC || ipfsModule.path() : undefined
    },
    go: {
      ipfsBin: isNode ? process.env.IPFS_GO_EXEC || goIpfsModule.path() : undefined
    }
  })
}
