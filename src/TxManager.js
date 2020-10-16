const ethers = require('ethers')
const { Mutex } = require('async-mutex')
const { GasPriceOracle } = require('gas-price-oracle')
const Transaction = require('./Transaction')

const defaultConfig = {
  MAX_RETRIES: 10,
  GAS_BUMP_PERCENTAGE: 5,
  MIN_GWEI_BUMP: 1,
  GAS_BUMP_INTERVAL: 1000 * 60 * 5,
  MAX_GAS_PRICE: 1000,
  GAS_LIMIT_MULTIPLIER: 1.1,
  POLL_INTERVAL: 5000,
  CONFIRMATIONS: 8,
  ESTIMATE_GAS: true,
}

class TxManager {
  constructor({ privateKey, rpcUrl, broadcastNodes = [], config = {} }) {
    this.config = Object.assign({ ...defaultConfig }, config)
    this._privateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey
    this._provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    this._wallet = new ethers.Wallet(this._privateKey, this._provider)
    this.address = this._wallet.address
    this._broadcastNodes = broadcastNodes
    this._gasPriceOracle = new GasPriceOracle({ defaultRpc: rpcUrl })
    this._mutex = new Mutex()
    this._nonce = null
  }

  /**
   * Creates Transaction class instance.
   *
   * @param tx Transaction to send
   */
  createTx(tx) {
    return new Transaction(tx, this)
  }
}

module.exports = TxManager
