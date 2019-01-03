'use strict'

/*
 * Wait for a condition to become true.  When its true, callback is called.
 */
module.exports = (predicate, ttl, callback) => {
  if (typeof ttl === 'function') {
    callback = ttl
    ttl = Date.now() + (10 * 1000)
  } else {
    ttl = Date.now() + ttl
  }

  const self = setInterval(() => {
    if (predicate()) {
      clearInterval(self)
      return callback()
    }
    if (Date.now() > ttl) {
      clearInterval(self)
      return callback(new Error('waitFor time expired'))
    }
  }, 50)
}
