const BN = require('bn.js')
const { BigNumber } = require('ethers')

/**
 * A promise that resolves after `ms` milliseconds
 */
const sleep = ms => new Promise(res => setTimeout(res, ms))

const max = (a, b) => BigNumber.from(BN.max(new BN(a.toString()), new BN(b.toString())).toString())

const min = (a, b) => BigNumber.from(BN.min(new BN(a.toString()), new BN(b.toString())).toString())

module.exports = {
  sleep,
  max,
  min,
}
