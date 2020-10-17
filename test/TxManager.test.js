require('dotenv').config()
require('chai').should()
const { parseUnits } = require('ethers').utils
const TxManager = require('../src/TxManager')
// const Transaction = require('../src/Transaction')
const { RPC_URL, PRIVATE_KEY } = process.env

describe('TxManager', () => {
  const manager = new TxManager({
    privateKey: PRIVATE_KEY,
    rpcUrl: RPC_URL,
    config: {
      CONFIRMATIONS: 3,
      GAS_BUMP_INTERVAL: 1000 * 15,
    },
  })

  const tx1 = {
    value: 1,
    gasPrice: parseUnits('1', 'gwei').toHexString(),
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

  describe('#transaction', () => {
    it('should work', async () => {
      const tx = manager.createTx(tx1)

      const receipt = await tx
        .send()
        .on('transactionHash', hash => console.log('hash', hash))
        .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
        .on('confirmations', confirmations => console.log('confirmations', confirmations))

      console.log('receipt', receipt)
    })

    it('should bump gas price', async () => {
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
  })
})
