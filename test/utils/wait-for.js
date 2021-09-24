import delay from 'delay'

/*
 * Wait for a condition to become true.
 */
export async function waitFor (predicate, ttl = 10e3, checkInterval = 50) {
  const timeout = Date.now() + ttl

  while (true) {
    if (predicate()) {
      return
    }

    await delay(checkInterval)

    if (Date.now() > timeout) {
      throw new Error('waitFor time expired')
    }
  }
}
