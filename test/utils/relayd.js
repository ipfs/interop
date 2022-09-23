import { isNode, isElectronMain } from 'wherearewe'
import fs from 'fs'
import path from 'path'
import { execaCommand } from 'execa'
import pTimeout from 'p-timeout'
import { download, LIBP2P_RELAY_DAEMON_VERSION } from '../../scripts/download-relay-daemon.js'
import os from 'os'
// @ts-expect-error no types
import goenv from 'go-platform'
const platform = process.env.TARGET_OS || goenv.GOOS

// augumentWithRelayd is the glue code that makes running relayd-based relay
// possible without changing too much in existing tests.  We keep one instance
// per circuit relay version.
const relays = new Map()

const RELAY_STARTUP_TIMEOUT = Number(process.env.RELAY_STARTUP_TIMEOUT || 30000)

/**
 * @param {number} version
 */
export async function getRelayV (version) {
  if (!isNode && !isElectronMain) {
    return
  }

  if (relays.has(version)) {
    return relays.get(version)
  }

  if (process.env.DEBUG) {
    console.log(`Starting relayd_v${version}..`) // eslint-disable-line no-console
  }

  if (version < 1 || version > 2) {
    throw new Error('Unsupported circuit relay version')
  }

  const binaryPath = path.join('scripts', `libp2p-relay-daemon${platform === 'windows' ? '.exe' : ''}`)
  const configPath = path.join('scripts', `relayd_v${version}.config.json`)
  const identityPath = path.join(os.tmpdir(), `relayd_v${version}-${Math.random()}.identity`)

  if (!fs.existsSync(binaryPath)) {
    console.info('libp2p-relay-daemon binary not found at', binaryPath) // eslint-disable-line no-console
    await download({
      version: LIBP2P_RELAY_DAEMON_VERSION,
      platform: process.env.TARGET_OS || goenv.GOOS || os.platform(),
      arch: process.env.TARGET_ARCH || goenv.GOARCH || os.arch(),
      distUrl: process.env.GO_IPFS_DIST_URL || 'https://dist.ipfs.io',
      installPath: path.resolve('scripts')
    })
  }

  if (process.env.DEBUG) {
    console.info(`${binaryPath} -config ${configPath} -id ${identityPath}`) // eslint-disable-line no-console
  }

  const relayd = execaCommand(`${binaryPath} -config ${configPath} -id ${identityPath}`, {
    all: true
  })

  const all = relayd.all

  if (all == null) {
    throw new Error('No stdout/stderr on execa return value')
  }

  const waitForStartup = async () => {
    let id = ''

    for await (const line of all) {
      const text = line.toString()

      if (process.env.DEBUG) {
        console.log(text) // eslint-disable-line no-console
      }

      if (text.includes(`RelayV${version} is running!`)) {
        return id
      }

      if (text.includes('I am')) {
        id = text.split('I am')[1].split('\n')[0].trim()
      }
    }
  }

  const promise = waitForStartup()
  promise.cancel = () => {
    console.error(`Timed out waiting for ${binaryPath} to start after ${RELAY_STARTUP_TIMEOUT}ms, killing process`) // eslint-disable-line no-console
    relayd.kill()
  }

  const id = await pTimeout(promise, {
    milliseconds: RELAY_STARTUP_TIMEOUT
  })

  const config = JSON.parse(fs.readFileSync(configPath, {
    encoding: 'utf-8'
  }))
  const result = {
    relayd,
    // Mock: make it look like other things returned by ipfsd-ctl to reuse existing code.
    api: {
      peerId: {
        id,
        addresses: [
          `${config.Network.ListenAddrs[0]}/p2p/${id}`
        ]
      },
      id: () => Promise.resolve({
        id,
        addresses: [
          `${config.Network.ListenAddrs[0]}/p2p/${id}`
        ]
      })
    }
  }
  relays.set(version, result)
  return result
}

export async function closeRelays () {
  for (const r of relays.values()) {
    r.relayd.cancel()
  }
}
