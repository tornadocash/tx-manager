const Web3 = require('web3')
const { Mutex } = require('async-mutex')
const { GasPriceOracle } = require('gas-price-oracle')
const Transaction = require('./Transaction')

const defaultConfig = {
  MAX_RETRIES: 10,
  GAS_BUMP_PERCENTAGE: 5,
  MIN_GWEI_BUMP: 1,
  GAS_BUMP_INTERVAL: 1000 * 60 * 5,
  MAX_GAS_PRICE: 1000,
  POLL_INTERVAL: 5000,
  CONFIRMATIONS: 8,
  ESTIMATE_GAS: true,
}

class TxManager {
  constructor({ privateKey, rpcUrl, broadcastNodes = [], config = {} }) {
    this.config = Object.assign({ ...defaultConfig }, config)
    this._privateKey = '0x' + privateKey
    this._web3 = new Web3(rpcUrl)
    this._broadcastNodes = broadcastNodes
    this.address = this._web3.eth.accounts.privateKeyToAccount(this._privateKey).address
    this._web3.eth.accounts.wallet.add(this._privateKey)
    this._web3.eth.defaultAccount = this.address
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
