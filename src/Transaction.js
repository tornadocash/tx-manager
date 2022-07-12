const ethers = require('ethers')
const { parseUnits, formatUnits } = ethers.utils
const BigNumber = ethers.BigNumber
const PromiEvent = require('web3-core-promievent')
const { sleep, min, max } = require('./utils')

const nonceErrors = [
  'Transaction nonce is too low. Try incrementing the nonce.',
  /nonce too low/i,
  'nonce has already been used',
  /OldNonce/,
  'invalid transaction nonce',
]
const nonceErrorCodes = ['SERVER_ERROR', 'NONCE_EXPIRED']

const gasPriceErrors = [
  'Transaction gas price supplied is too low. There is another transaction with same nonce in the queue. Try increasing the gas price or incrementing the nonce.',
  /replacement transaction underpriced/i,
  /transaction underpriced/,
  /Transaction gas price \d+wei is too low. There is another transaction with same nonce in the queue with gas price: \d+wei. Try increasing the gas price or incrementing the nonce./,
  /FeeTooLow/,
  /max fee per gas less than block base fee/,
]

// prettier-ignore
const sameTxErrors = [
  'Transaction with the same hash was already imported.',
  'already known',
  'AlreadyKnown',
  'Known transaction',
]

class Transaction {
  constructor(tx, manager) {
    this.manager = manager
    this.tx = { ...tx }
    this._promise = PromiEvent()
    this._emitter = this._promise.eventEmitter
    this.executed = false
    this.replaced = false
    this.retries = 0
    this.currentTxHash = null
    // store all submitted hashes to catch cases when an old tx is mined
    this.hashes = []
  }

  /**
   * Submits the transaction to Ethereum network. Resolves when tx gets enough confirmations.
   * Emits progress events.
   */
  send() {
    if (this.executed) {
      throw new Error('The transaction was already executed')
    }
    this.executed = true
    this._execute().then(this._promise.resolve).catch(this._promise.reject)
    return this._emitter
  }

  /**
   * Replaces a pending tx.
   *
   * @param tx Transaction to send
   */
  async replace(tx) {
    // todo throw error if the current transaction is mined already
    // if (this.currentTxHash) {
    //   throw new Error('Previous transaction was mined')
    // }

    console.log('Replacing current transaction')
    if (!this.executed) {
      // Tx was not executed yet, just replace it
      this.tx = { ...tx }
      return
    }

    if (!tx.gasLimit) {
      const estimatedGasLimit = await this._estimateGas(tx)
      const gasLimit = estimatedGasLimit
        .mul(Math.floor(this.manager.config.GAS_LIMIT_MULTIPLIER * 100))
        .div(100)

      tx.gasLimit = this.manager.config.BLOCK_GAS_LIMIT
        ? min(gasLimit, this.manager.config.BLOCK_GAS_LIMIT)
        : gasLimit
    }

    tx.chainId = this.tx.chainId
    tx.nonce = this.tx.nonce // can be different from `this.manager._nonce`

    // start no less than current tx gas params
    if (this.tx.gasPrice) {
      tx.gasPrice = max(this.tx.gasPrice, tx.gasPrice || 0)
    } else if (this.tx.maxFeePerGas) {
      tx.maxFeePerGas = max(this.tx.maxFeePerGas, tx.maxFeePerGas || 0)
      tx.maxPriorityFeePerGas = max(this.tx.maxPriorityFeePerGas, tx.maxPriorityFeePerGas || 0)
    }

    this.tx = { ...tx }
    await this._prepare()

    if (tx.gasPrice || tx.maxFeePerGas) {
      this._increaseGasPrice()
    }

    this.replaced = true
    await this._send()
  }

  /**
   * Cancels a pending tx.
   */
  cancel() {
    console.log('Canceling the transaction')
    return this.replace({
      from: this.manager.address,
      to: this.manager.address,
      value: 0,
    })
  }

  /**
   * Executes the transaction. Acquires global mutex for transaction duration
   *
   * @returns {Promise<TransactionReceipt>}
   * @private
   */
  async _execute() {
    const mutexRelease = await this.manager._mutex.acquire()
    try {
      await this._prepare()
      await this._send()
      const receipt = await this._waitForConfirmations()
      // we could have bumped nonce during execution, so get the latest one + 1
      this.manager._nonce = this.tx.nonce + 1
      return receipt
    } finally {
      mutexRelease()
    }
  }

  /**
   * Prepare first transaction before submitting it. Inits `gas`, `gasPrice`, `nonce`
   *
   * @returns {Promise<void>}
   * @private
   */
  async _prepare() {
    if (!this.manager.config.BLOCK_GAS_LIMIT) {
      const lastBlock = await this.manager._provider.getBlock('latest')
      this.manager.config.BLOCK_GAS_LIMIT = Math.floor(lastBlock.gasLimit.toNumber() * 0.95)
    }

    if (!this.manager._chainId) {
      const net = await this.manager._provider.getNetwork()
      this.manager._chainId = net.chainId
    }

    if (!this.tx.chainId) {
      this.tx.chainId = this.manager._chainId
    }

    if (!this.tx.gasLimit || this.manager.config.ESTIMATE_GAS) {
      const gas = await this._estimateGas(this.tx)
      if (!this.tx.gasLimit) {
        const gasLimit = Math.floor(gas * this.manager.config.GAS_LIMIT_MULTIPLIER)
        this.tx.gasLimit = Math.min(gasLimit, this.manager.config.BLOCK_GAS_LIMIT)
      }
    }

    if (!this.manager._nonce) {
      this.manager._nonce = await this._getLastNonce()
    }

    if (!this.tx.nonce) {
      this.tx.nonce = this.manager._nonce
    }

    if (!this.tx.gasPrice && !this.tx.maxFeePerGas && !this.tx.maxPriorityFeePerGas) {
      const gasParams = await this._getGasParams()
      this.tx = Object.assign(this.tx, gasParams)
    }
  }

  /**
   * Send the current transaction
   *
   * @returns {Promise}
   * @private
   */
  async _send() {
    // todo throw is we attempt to send a tx that attempts to replace already mined tx
    const signedTx = await this.manager._wallet.signTransaction(this.tx)
    this.submitTimestamp = Date.now()
    const txHash = ethers.utils.keccak256(signedTx)
    this.hashes.push(txHash)

    try {
      await this._broadcast(signedTx)
    } catch (e) {
      return this._handleRpcError(e, '_send')
    }

    this._emitter.emit('transactionHash', txHash)
    console.log(`Broadcasted transaction ${txHash}`)
  }

  /**
   * A loop that waits until the current transaction is mined and gets enough confirmations
   *
   * @returns {Promise<TransactionReceipt>} The transaction receipt
   * @private
   */
  async _waitForConfirmations() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // We are already waiting on certain tx hash
      if (this.currentTxHash) {
        const receipt = await this.manager._provider.getTransactionReceipt(this.currentTxHash)

        if (!receipt) {
          // We were waiting for some tx but it disappeared
          // Erase the hash and start over
          this.currentTxHash = null
          continue
        }

        const currentBlock = await this.manager._provider.getBlockNumber()
        const confirmations = Math.max(0, currentBlock - receipt.blockNumber)
        // todo don't emit repeating confirmation count
        this._emitter.emit('confirmations', confirmations)
        if (confirmations >= this.manager.config.CONFIRMATIONS) {
          // Tx is mined and has enough confirmations
          if (this.manager.config.THROW_ON_REVERT && Number(receipt.status) === 0) {
            throw new Error('EVM execution failed, so the transaction was reverted.')
          }
          return receipt
        }

        // Tx is mined but doesn't have enough confirmations yet, keep waiting
        await sleep(this.manager.config.POLL_INTERVAL)
        continue
      }

      // Tx is still pending
      if ((await this._getLastNonce()) <= this.tx.nonce) {
        // todo optionally run estimateGas on each iteration and cancel the transaction if it fails

        // We were waiting too long, increase gas price and resubmit
        if (Date.now() - this.submitTimestamp >= this.manager.config.GAS_BUMP_INTERVAL) {
          if (this._increaseGasPrice()) {
            console.log('Resubmitting with higher gas params')
            await this._send()
            continue
          }
        }
        // Tx is still pending, keep waiting
        await sleep(this.manager.config.POLL_INTERVAL)
        continue
      }

      // There is a mined tx with our nonce, let's see if it has a known hash
      let receipt = await this._getReceipts()

      // There is a mined tx with current nonce, but it's not one of ours
      // Probably other tx submitted by other process/client
      if (!receipt) {
        console.log("Can't find our transaction receipt, retrying a few times")
        // Give node a few more attempts to respond with our receipt
        let retries = 5
        while (!receipt && retries--) {
          await sleep(1000)
          receipt = await this._getReceipts()
        }

        // Receipt was not found after a few retries
        // Resubmit our tx
        if (!receipt) {
          console.log(
            'There is a mined tx with our nonce but unknown tx hash, resubmitting with tx with increased nonce',
          )
          this.tx.nonce++
          // todo drop gas price to original value?
          await this._send()
          continue
        }
      }

      this._emitter.emit('mined', receipt)
      this.currentTxHash = receipt.transactionHash
    }
  }

  async _getReceipts() {
    for (const hash of this.hashes.reverse()) {
      const receipt = await this.manager._provider.getTransactionReceipt(hash)
      if (receipt) {
        return receipt
      }
    }
    return null
  }

  /**
   * Broadcasts tx to multiple nodes, waits for tx hash only on main node
   */
  async _broadcast(rawTx) {
    const main = await this.manager._provider.sendTransaction(rawTx)
    for (const node of this.manager._broadcastNodes) {
      try {
        await new ethers.providers.JsonRpcProvider(node).sendTransaction(rawTx)
      } catch (e) {
        console.log(`Failed to send transaction to node ${node}: ${e}`)
      }
    }
    return main
  }

  _handleRpcError(e, method) {
    if (e.error?.error) {
      // Sometimes ethers wraps known errors, unwrap it in this case
      e = e.error
    }

    if (e.error && nonceErrorCodes.includes(e.code)) {
      const message = e.error.message

      // nonce is too low, trying to increase and resubmit
      if (this._hasError(message, nonceErrors)) {
        if (this.replaced) {
          console.log('Transaction with the same nonce was mined')
          return // do nothing
        }
        console.log(`Nonce ${this.tx.nonce} is too low, increasing and retrying`)
        if (this.retries <= this.manager.config.MAX_RETRIES) {
          this.tx.nonce++
          this.retries++
          return this[method]()
        }
      }

      // there is already a pending tx with higher gas price, trying to bump and resubmit
      if (this._hasError(message, gasPriceErrors)) {
        console.log(
          `Gas price ${formatUnits(
            this.tx.gasPrice || this.tx.maxFeePerGas,
            'gwei',
          )} gwei is too low, increasing and retrying`,
        )
        if (this._increaseGasPrice()) {
          return this[method]()
        } else {
          throw new Error('Already at max gas price, but still not enough to submit the transaction')
        }
      }

      if (this._hasError(message, sameTxErrors)) {
        console.log('Same transaction is already in mempool, skipping submit')
        return // do nothing
      }
    }

    throw new Error(`Send error: ${e}`)
  }

  /**
   * Returns whether error message is contained in errors array
   *
   * @param message The message to look up
   * @param {Array<string|RegExp>} errors Array with errors. Errors can be either string or regexp.
   * @returns {boolean} Returns true if error message is present in the `errors` array
   * @private
   */
  _hasError(message, errors) {
    return errors.find(e => (typeof e === 'string' ? e === message : message.match(e))) !== undefined
  }

  _increaseGasPrice() {
    const maxGasPrice = parseUnits(this.manager.config.MAX_GAS_PRICE.toString(), 'gwei')
    const minGweiBump = parseUnits(this.manager.config.MIN_GWEI_BUMP.toString(), 'gwei')

    if (this.tx.gasPrice) {
      const oldGasPrice = BigNumber.from(this.tx.gasPrice)
      if (oldGasPrice.gte(maxGasPrice)) {
        console.log('Already at max gas price, not bumping')
        return false
      }

      const newGasPrice = max(
        oldGasPrice.mul(100 + this.manager.config.GAS_BUMP_PERCENTAGE).div(100),
        oldGasPrice.add(minGweiBump),
      )
      this.tx.gasPrice = min(newGasPrice, maxGasPrice).toHexString()
      console.log(`Increasing gas price to ${formatUnits(this.tx.gasPrice, 'gwei')} gwei`)
    } else {
      const oldMaxFeePerGas = BigNumber.from(this.tx.maxFeePerGas)
      const oldMaxPriorityFeePerGas = BigNumber.from(this.tx.maxPriorityFeePerGas)
      if (oldMaxFeePerGas.gte(maxGasPrice)) {
        console.log('Already at max fee per gas, not bumping')
        return false
      }

      const newMaxFeePerGas = max(
        oldMaxFeePerGas.mul(100 + this.manager.config.GAS_BUMP_PERCENTAGE).div(100),
        oldMaxFeePerGas.add(minGweiBump),
      )
      const newMaxPriorityFeePerGas = max(
        oldMaxPriorityFeePerGas.mul(100 + this.manager.config.GAS_BUMP_PERCENTAGE).div(100),
        oldMaxPriorityFeePerGas.add(minGweiBump),
      )

      const maxFeePerGas = min(newMaxFeePerGas, maxGasPrice)

      this.tx.maxFeePerGas = maxFeePerGas.toHexString()
      this.tx.maxPriorityFeePerGas = min(newMaxPriorityFeePerGas, maxFeePerGas).toHexString()

      console.log(`Increasing maxFeePerGas to ${formatUnits(this.tx.maxFeePerGas, 'gwei')} gwei`)
    }

    return true
  }

  /**
   * Gets current nonce for the current account, ignoring any pending transactions
   *
   * @returns {Promise<number>}
   * @private
   */
  _getLastNonce() {
    return this.manager._wallet.getTransactionCount('latest')
  }

  /**
   * Choose network gas params
   *
   * @returns {Promise<object>}
   * @private
   */
  async _getGasParams() {
    const maxGasPrice = parseUnits(this.manager.config.MAX_GAS_PRICE.toString(), 'gwei')
    const gasParams = await this.manager._gasPriceOracle.getTxGasParams({
      isLegacy: !this.manager.config.ENABLE_EIP1559,
    })
    if (gasParams.gasPrice) {
      gasParams.gasPrice = min(gasParams.gasPrice, maxGasPrice)
    } else {
      gasParams.maxFeePerGas = min(gasParams?.maxFeePerGas, maxGasPrice)
      gasParams.maxPriorityFeePerGas = min(gasParams?.maxPriorityFeePerGas, maxGasPrice)
    }
    gasParams.type = gasParams?.maxFeePerGas ? 2 : 0
    return gasParams
  }

  async _estimateGas(tx) {
    try {
      return await this.manager._wallet.estimateGas(tx)
    } catch (e) {
      return this._handleRpcError(e, '_estimateGas')
    }
  }
}

module.exports = Transaction
