import path from 'path'
import { createServer } from 'ipfsd-ctl'
import { sigServer } from '@libp2p/webrtc-star-signalling-server'
import { fileURLToPath } from 'url'
import { resolve } from 'import-meta-resolve'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ipfsModule = await resolve(process.env.IPFS_JS_HTTP_MODULE || 'ipfs', import.meta.url)
const ipfsHttpModule = await resolve(process.env.IPFS_JS_HTTP_MODULE || 'ipfs-http-client', import.meta.url)
const kuboRpcModule = await resolve(process.env.KUBO_RPC_MODULE || 'kubo-rpc-client', import.meta.url)

async function findGoIpfsBin () {
  if (process.env.IPFS_GO_EXEC != null) {
    return process.env.IPFS_GO_EXEC
  }

  const modulePath = await resolve(process.env.IPFS_GO_IPFS_MODULE || 'go-ipfs', import.meta.url)
  const module = await import(modulePath.replace('file://', ''))

  return module.path()
}

/** @type {import('aegir').Options["build"]["config"]} */
const esbuild = {
  inject: [path.join(__dirname, 'scripts/node-globals.js')],
  plugins: [
    {
      name: 'node built ins',
      setup (build) {
        build.onResolve({ filter: /^ipfs$/ }, () => {
          return { path: ipfsModule.replace('file://', '') }
        })
        build.onResolve({ filter: /^ipfs-http-client$/ }, () => {
          return { path: ipfsHttpModule.replace('file://', '') }
        })
        build.onResolve({ filter: /^kubo-rpc-client$/ }, () => {
          return { path: kuboRpcModule.replace('file://', '') }
        })
      }
    }
  ]
}

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    browser: {
      config: {
        buildConfig: esbuild
      }
    },
    async before (options) {
      const ipfsHttpModule = await import(process.env.IPFS_JS_HTTP_MODULE || 'ipfs-http-client')
      const kuboRpcModule = await import(process.env.KUBO_RPC_MODULE || 'kubo-rpc-client')
      const ipfsModule = await import(process.env.IPFS_JS_MODULE || 'ipfs')

      if (options.runner !== 'node') {
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: 43134
        }, {
          type: 'go',
          test: true,
        }, {
          go: {
            ipfsBin: await findGoIpfsBin(),
            kuboRpcModule: kuboRpcModule
          },
          js: {
            ipfsOptions: {
              config: {
                libp2p: {
                  dialer: {
                    dialTimeout: 60e3 // increase timeout because travis is slow
                  }
                }
              }
            },
            ipfsModule,
            ipfsBin: process.env.IPFS_JS_EXEC || ipfsModule.path(),
            ipfsHttpModule,
          }
        }).start()

        const signallingServer = await sigServer({
          port: 24642,
          host: '0.0.0.0',
          metrics: false
        })

        return {
          ipfsdServer,
          signallingServer
        }
      }
    },
    async after (options, before) {
      if (options.runner !== 'node') {
        await before.ipfsdServer.stop()
        await before.signallingServer.stop()
      }
    }
  }
}
