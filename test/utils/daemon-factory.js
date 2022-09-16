import { createFactory } from 'ipfsd-ctl'
import { isNode, isElectronMain } from 'wherearewe'

export async function daemonFactory () {
  let ipfsHttpModule
  let ipfsModule

  try {
    // @ts-expect-error env var could be undefined
    ipfsHttpModule = await import(process.env.IPFS_JS_HTTP_MODULE)
  } catch {
    ipfsHttpModule = await import('ipfs-http-client')
  }

  try {
    // @ts-expect-error env var could be undefined
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
  if (!isNode && !isElectronMain) {
    return
  }

  if (process.env[envVar]) {
    return process.env[envVar]
  }

  const mod = module || await import(moduleName)

  return mod.path()
}
