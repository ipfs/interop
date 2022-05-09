import path from 'path'
import { createServer } from 'ipfsd-ctl'
import { sigServer } from '@libp2p/webrtc-star-signalling-server'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('aegir').Options["build"]["config"]} */
const esbuild = {
  inject: [path.join(__dirname, 'scripts/node-globals.js')],
  plugins: [
    {
      name: 'node built ins',
      setup (build) {
        build.onResolve({ filter: /^ipfs$/ }, () => {
          return { path: require.resolve(process.env.IPFS_JS_MODULE || 'ipfs') }
        })
        build.onResolve({ filter: /^ipfs-http-client$/ }, () => {
          return { path: require.resolve(process.env.IPFS_JS_HTTP_MODULE || 'ipfs-http-client') }
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
      const ipfsModule = await import(process.env.IPFS_JS_MODULE || 'ipfs')

      if (options.runner !== 'node') {
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: 43134
        }, {
          type: 'go',
          test: true,
          ipfsHttpModule
        }, {
          go: {
            ipfsBin: process.env.IPFS_GO_EXEC || require(process.env.IPFS_GO_IPFS_MODULE || 'go-ipfs').path()
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
            ipfsBin: process.env.IPFS_JS_EXEC || ipfsModule.path()
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
