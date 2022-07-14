const { BigNumber } = require('ethers')
/**
 * A promise that resolves after `ms` milliseconds
 */
const sleep = ms => new Promise(res => setTimeout(res, ms))

const max = (a, b) => (BigNumber.from(a).gt(b) ? a : b)

const min = (a, b) => (BigNumber.from(a).lt(b) ? a : b)

module.exports = {
  sleep,
  max,
  min,
}
