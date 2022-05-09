import { isNode } from 'wherearewe'
import fs from 'fs'
import path from 'path'
import { execaCommand } from 'execa'
// @ts-expect-error no types
import goenv from 'go-platform'
const platform = process.env.TARGET_OS || goenv.GOOS

// augumentWithRelayd is the glue code that makes running relayd-based relay
// possible without changing too much in existing tests.  We keep one instance
// per circuit relay version.
const relays = new Map()

/**
 * @param {number} version
 */
export async function getRelayV (version) {
  if (!isNode) return
  if (relays.has(version)) return relays.get(version)
  if (process.env.DEBUG) console.log(`Starting relayd_v${version}..`) // eslint-disable-line no-console
  if (version < 1 || version > 2) throw new Error('Unsupported circuit relay version')
  const binaryPath = path.join('scripts', `libp2p-relay-daemon${platform === 'windows' ? '.exe' : ''}`)
  const configPath = path.join('scripts', `relayd_v${version}.config.json`)
  const identityPath = path.join('scripts', `relayd_v${version}.identity`)
  const relayd = execaCommand(`${binaryPath} -config ${configPath} -id ${identityPath}`)
  let id = ''

  if (relayd.stdout == null) {
    throw new Error('No std out on execa return value')
  }

  for await (const line of relayd.stdout) {
    const text = line.toString()
    if (process.env.DEBUG) console.log(text) // eslint-disable-line no-console
    if (text.includes(`RelayV${version} is running!`)) break
    if (text.includes('I am')) {
      id = text.split('I am')[1].split('\n')[0].trim()
    }
  }
  const config = JSON.parse(fs.readFileSync(configPath).toString())
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
