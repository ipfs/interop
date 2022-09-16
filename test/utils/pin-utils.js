import os from 'os'
import path from 'path'
import { nanoid } from 'nanoid'
import all from 'it-all'
import drain from 'it-drain'

/**
 * @param {import('ipfsd-ctl').Controller} daemon
 */
export async function removeAllPins (daemon) {
  const pins = await all(daemon.api.pin.ls())
  const rootPins = pins.filter(pin => pin.type === 'recursive' || pin.type === 'direct')

  await drain(daemon.api.pin.rmAll(rootPins.map(pin => ({ cid: pin.cid }))))

  return daemon
}

export function tmpPath () {
  return path.join(os.tmpdir(), nanoid())
}
