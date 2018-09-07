'use strict'

const expect = require('chai').expect

class ExpectedError extends Error {

}

const compare = (...ops) => {
  expect(ops.length).to.be.above(1)

  return Promise.all(
    ops
  )
    .then(results => {
      expect(results.length).to.equal(ops.length)

      const result = results.pop()

      results.forEach(res => expect(res).to.deep.equal(result))
    })
}

const compareErrors = (...ops) => {
  expect(ops.length).to.be.above(1)

  return Promise.all(
    // even if operations fail, their errors should be the same
    ops.map(op => op.then(() => {
      throw new ExpectedError('Expected operation to fail')
    }).catch(error => {
      if (error instanceof ExpectedError) {
        throw error
      }

      return {
        message: error.message,
        code: error.code
      }
    }))
  )
    .then(results => {
      expect(results.length).to.equal(ops.length)

      const result = results.pop()

      results.forEach(res => expect(res).to.deep.equal(result))
    })
}

module.exports = {
  compare,
  compareErrors
}
