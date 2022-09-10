#!/usr/bin/env node

// this script will download the libp2p-relay-daemon binary
// for windows/macos/linux. based on parts of https://github.com/ipfs/npm-go-ipfs

import { download, LIBP2P_RELAY_DAEMON_VERSION } from './download-relay-daemon.js'
import os from 'os'
import path from 'path'
// @ts-expect-error no types
import goenv from 'go-platform'

download({
  version: LIBP2P_RELAY_DAEMON_VERSION,
  platform: process.env.TARGET_OS || goenv.GOOS || os.platform(),
  arch: process.env.TARGET_ARCH || goenv.GOARCH || os.arch(),
  distUrl: process.env.GO_IPFS_DIST_URL || 'https://dist.ipfs.io',
  installPath: path.resolve('scripts')
})
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
