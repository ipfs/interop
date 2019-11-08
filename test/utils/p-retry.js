'use strict'

const pRetry = require('p-retry')
const timeout = require('./timeout')

/*
 * This is a wrapper for pRetry enabling an interval value
 * i.e., the time to wait between retries, in milliseconds
 *
 * This must be removed as soon as https://github.com/sindresorhus/p-retry/issues/27
 * gets resolved
 */
module.exports = (input, options = {}) => {
  if (!options.interval) {
    return pRetry(input, options)
  }

  return pRetry(async () => {
    let error

    try {
      await input()
    } catch (err) {
      error = err
    }

    if (error) {
      // Wait options.interval milliseconds to call the next retry
      await timeout(options.interval)
      throw error
    }
  }, options)
}
