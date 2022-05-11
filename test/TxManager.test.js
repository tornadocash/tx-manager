require('dotenv').config()
require('chai').should()
const { providers } = require('ethers')
const { parseUnits } = require('ethers').utils
const TxManager = require('../src/TxManager')
// const Transaction = require('../src/Transaction')
const { RPC_URL, PRIVATE_KEY } = process.env

describe('TxManager', () => {
  let manager

  const tx1 = {
    value: 1,
    gasPrice: parseUnits('2', 'gwei').toHexString(),
    to: '0xA43Ce8Cc89Eff3AA5593c742fC56A30Ef2427CB0',
  }

  const tx2 = {
    value: 1,
    gasPrice: parseUnits('0.5', 'gwei').toHexString(),
    to: '0xA43Ce8Cc89Eff3AA5593c742fC56A30Ef2427CB0',
  }

  const tx3 = {
    value: 2,
    to: '0x0039F22efB07A647557C7C5d17854CFD6D489eF3',
  }

  const tx4 = {
    value: 1,
    to: '0xA43Ce8Cc89Eff3AA5593c742fC56A30Ef2427CB0',
  }

  const tx5 = {
    value: 1,
    to: '0xA43Ce8Cc89Eff3AA5593c742fC56A30Ef2427CB0',
    maxFeePerGas: parseUnits('7', 'gwei').toHexString(),
    maxPriorityFeePerGas: parseUnits('1', 'gwei').toHexString(),
    type: 2,
  }

  before(async () => {
    const provider = new providers.JsonRpcProvider(RPC_URL)

    const { name, chainId } = await provider.getNetwork()
    console.log('\n\n', 'network', { name, chainId }, '\n\n')

    manager = new TxManager({
      privateKey: PRIVATE_KEY,
      rpcUrl: RPC_URL,
      config: {
        CONFIRMATIONS: 1,
        GAS_BUMP_INTERVAL: 1000 * 20,
      },
      gasPriceOracleConfig: {
        chainId: chainId,
        defaultRpc: RPC_URL,
      },
    })
  })

  describe('#transaction', () => {
    it('should work legacy tx', async () => {
      const tx = manager.createTx(tx1)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should work eip-1559 tx', async () => {
      const tx = manager.createTx(tx5)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should fetch gas params', async () => {
      const tx = manager.createTx(tx4)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should bump gas params', async () => {
      const tx = manager.createTx(tx2)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should cancel', async () => {
      const tx = manager.createTx(tx2)

      setTimeout(() => tx.cancel(), 1000)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should replace', async () => {
      const tx = manager.createTx(tx2)

      setTimeout(() => tx.replace(tx3), 1000)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should increase nonce', async () => {
      const currentNonce = await manager._wallet.getTransactionCount('latest')

      manager._nonce = currentNonce - 1

      const tx = manager.createTx(tx4)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should disable eip-1559 transactions', async () => {
      manager.config.ENABLE_EIP1559 = false

      const tx = manager.createTx(tx3)
      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))
      console.log('receipt', receipt)

      manager.config.ENABLE_EIP1559 = true
    })

    it('should send multiple txs', async () => {
      const genTx = value => ({
        value,
        to: '0x0039F22efB07A647557C7C5d17854CFD6D489eF3',
      })
      await Promise.all([
        manager.createTx(genTx(1)).send(),
        manager.createTx(genTx(2)).send(),
        manager.createTx(genTx(3)).send(),
        manager.createTx(genTx(4)).send(),
        manager.createTx(genTx(5)).send(),
        manager.createTx(genTx(6)).send(),
        manager.createTx(genTx(7)).send(),
        manager.createTx(genTx(8)).send(),
        manager.createTx(genTx(9)).send(),
        manager.createTx(genTx(10)).send(),
      ])
    }).timeout(600000)
  })
})
