'use strict'

const delay = require('delay')

/*
 * Wait for a condition to become true.
 */
module.exports = async (predicate, ttl = 10e3, checkInterval = 50) => {
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
