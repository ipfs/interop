'use strict'

/*
 * Wait for a condition to become true.  When its true, callback is called.
 */
module.exports = (predicate, ttl) => {
  ttl = ttl ? Date.now() + ttl : Date.now() + (10 * 1000)

  return new Promise((resolve, reject) => {
    const self = setInterval(() => {
      if (predicate()) {
        clearInterval(self)
        resolve()
      }
      if (Date.now() > ttl) {
        clearInterval(self)
        reject(new Error('waitFor time expired'))
      }
    }, 50)
  })
}
