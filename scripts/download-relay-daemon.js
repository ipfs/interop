#!/usr/bin/env node

// this script will download the libp2p-relay-daemon binary
// for windows/macos/linux. based on parts of https://github.com/ipfs/npm-go-ipfs

// @ts-expect-error no types
import gunzip from 'gunzip-maybe'
import got from 'got'
import path from 'path'
// @ts-expect-error no types
import tarFS from 'tar-fs'
// @ts-expect-error no types
import unzip from 'unzip-stream'
// @ts-expect-error no types
import cachedir from 'cachedir'
import fs from 'fs'
import os from 'os'
import hasha from 'hasha'

// libp2p-relay-daemon version from https://dist.ipfs.io/libp2p-relay-daemon/
export const LIBP2P_RELAY_DAEMON_VERSION = 'v0.1.0'

/**
 * avoid expensive fetch if file is already in cache
 *
 * @param {string} url
 */
async function cachingFetchAndVerify (url) {
  const cacheDir = process.env.NPM_GO_LIBP2P_RELAY_DAEMON_CACHE || cachedir('npm-go-libp2p-relay-daemon')
  const filename = url.split('/').pop()

  if (!filename) {
    throw new Error('Invalid URL')
  }

  const cachedFilePath = path.join(cacheDir, filename)
  const cachedHashPath = `${cachedFilePath}.sha512`

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  if (!fs.existsSync(cachedFilePath)) {
    console.info(`Downloading ${url} to ${cacheDir}`)
    // download file
    fs.writeFileSync(cachedFilePath, await got(url).buffer())
    console.info(`Downloaded ${url}`)

    // ..and checksum
    console.info(`Downloading ${filename}.sha512`)
    fs.writeFileSync(cachedHashPath, await got(`${url}.sha512`).buffer())
    console.info(`Downloaded ${filename}.sha512`)
  } else {
    console.info(`Found ${cachedFilePath}`)
  }

  console.info(`Verifying ${filename}.sha512`)

  const digest = Buffer.alloc(128)
  const fd = fs.openSync(cachedHashPath, 'r')
  fs.readSync(fd, digest, 0, digest.length, 0)
  fs.closeSync(fd)
  const expectedSha = digest.toString('utf8')
  const calculatedSha = await hasha.fromFile(cachedFilePath, { encoding: 'hex', algorithm: 'sha512' })
  if (calculatedSha !== expectedSha) {
    console.log(`Expected   SHA512: ${expectedSha}`)
    console.log(`Calculated SHA512: ${calculatedSha}`)
    throw new Error(`SHA512 of ${cachedFilePath}' (${calculatedSha}) does not match expected value from ${cachedFilePath}.sha512 (${expectedSha})`)
  }
  console.log(`OK (${expectedSha})`)

  return fs.createReadStream(cachedFilePath)
}

/**
 * @param {string} version
 * @param {string} platform
 * @param {string} arch
 * @param {string} distUrl
 */
async function getDownloadURL (version, platform, arch, distUrl) {
  const data = await got(`${distUrl}/libp2p-relay-daemon/${version}/dist.json`).json()

  if (!data.platforms[platform]) {
    throw new Error(`No binary available for platform '${platform}'. Available platforms: ${Object.keys(data.platforms).join(', ')}`)
  }

  if (!data.platforms[platform].archs[arch]) {
    throw new Error(`No binary available for platform '${platform}' and arch '${arch}'. Available architectures: ${Object.keys(data.platforms[platform].archs)}`)
  }

  const link = data.platforms[platform].archs[arch].link
  return `${distUrl}/libp2p-relay-daemon/${version}${link}`
}

/**
 * @param {string} url
 * @param {string} installPath
 * @param {import('stream').Readable} stream
 */
function unpack (url, installPath, stream) {
  return new Promise((resolve, reject) => {
    if (url.endsWith('.zip')) {
      return stream.pipe(
        unzip
          .Extract({ path: installPath })
          .on('close', resolve)
          .on('error', reject)
      )
    }

    return stream
      .pipe(gunzip())
      .pipe(
        tarFS
          .extract(installPath)
          .on('finish', resolve)
          .on('error', reject)
      )
  })
}

/**
 * @param {object} options
 * @param {string} options.version
 * @param {string} options.platform
 * @param {string} options.arch
 * @param {string} options.installPath
 * @param {string} options.distUrl
 */
export async function download ({ version, platform, arch, installPath, distUrl }) {
  const url = await getDownloadURL(version, platform, arch, distUrl)
  const data = await cachingFetchAndVerify(url)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-libp2p-relay-daemon'))
  await unpack(url, tmpDir, data)

  const filename = `libp2p-relay-daemon${platform === 'windows' ? '.exe' : ''}`
  const tmpPath = path.join(tmpDir, 'libp2p-relay-daemon', filename)
  const finalPath = path.join(installPath, filename)
  try {
    // will throw if the file cannot be accessed
    fs.accessSync(finalPath)
    // remove old binary, just to be sure we always use the correct version
    fs.rmSync(finalPath, { recursive: true })
  } catch (e) {}
  fs.cpSync(tmpPath, finalPath)
  fs.rmSync(tmpDir, { recursive: true })
  console.info(`Unpacked binary placed in ${finalPath}`)

  return finalPath
}
