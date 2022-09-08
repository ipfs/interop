
import isNode from 'detect-node'
import ipfsdWrapper from 'ipfsd-ctl-wrapper'

export async function daemonFactory () {
  let ipfsHttpModule
  let ipfsModule
  const { createFactory } = await ipfsdWrapper()

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

  return createFactory({
    type: 'go',
    test: true,
    ipfsHttpModule
  }, {
    proc: {
      ipfsModule
    },
    js: {
      ipfsBin: await findBin('IPFS_JS_EXEC', 'ipfs', ipfsModule)
    },
    go: {
      ipfsBin: await findBin('IPFS_GO_EXEC', 'go-ipfs')
    }
  })
}

/**
 * @param {string} envVar
 * @param {string} moduleName
 * @param {{ path: () => string }} [module]
 */
async function findBin (envVar, moduleName, module) {
  if (!isNode) {
    return
  }

  if (process.env[envVar]) {
    return process.env[envVar]
  }

  const mod = module || await import(moduleName)

  return mod.path()
}
