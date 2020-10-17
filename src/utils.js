/**
 * A promise that resolves after `ms` milliseconds
 */
const sleep = ms => new Promise(res => setTimeout(res, ms))

const max = (a, b) => (a.gt(b) ? a : b)

const min = (a, b) => (a.lt(b) ? a : b)

module.exports = {
  sleep,
  max,
  min,
}
