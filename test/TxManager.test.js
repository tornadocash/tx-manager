require('dotenv').config()
require('chai').should()
const { providers } = require('ethers')
const { parseUnits } = require('ethers').utils
const TxManager = require('../src/TxManager')
const Web3 = require('web3')
const { RPC_URL, PRIVATE_KEY } = process.env

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

const defaultOptions = {
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL,
  config: {
    CONFIRMATIONS: 1,
    GAS_BUMP_INTERVAL: 1000 * 20,
  },
  gasPriceOracleConfig: {
    chainId: 1,
    defaultRpc: RPC_URL,
  },
  provider: undefined,
}
const transactionTests = () => {
  it('should work legacy tx', async () => {
    const tx = this.manager.createTx(tx1)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should work eip-1559 tx', async () => {
    const tx = this.manager.createTx(tx5)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should fetch gas params', async () => {
    const tx = this.manager.createTx(tx4)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should bump gas params', async () => {
    const tx = this.manager.createTx(tx2)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should cancel', async () => {
    const tx = this.manager.createTx(tx2)

    setTimeout(() => tx.cancel(), 1000)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should replace', async () => {
    const tx = this.manager.createTx(tx2)

    setTimeout(() => tx.replace(tx3), 1000)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should increase nonce', async () => {
    const currentNonce = await this.manager._wallet.getTransactionCount('latest')

    this.manager._nonce = currentNonce - 1

    const tx = this.manager.createTx(tx4)

    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))

    console.log('receipt', receipt)
  })

  it('should disable eip-1559 transactions', async () => {
    this.manager.config.ENABLE_EIP1559 = false

    const tx = this.manager.createTx(tx3)
    const receipt = await tx
      .send()
      .on('transactionHash', hash => console.log('hash', hash))
      .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
      .on('confirmations', confirmations => console.log('confirmations', confirmations))
    console.log('receipt', receipt)

    this.manager.config.ENABLE_EIP1559 = true
  })

  it('should send multiple txs', async () => {
    const genTx = value => ({
      value,
      to: '0x0039F22efB07A647557C7C5d17854CFD6D489eF3',
    })
    await Promise.all([
      this.manager.createTx(genTx(1)).send(),
      this.manager.createTx(genTx(2)).send(),
      this.manager.createTx(genTx(3)).send(),
      this.manager.createTx(genTx(4)).send(),
      this.manager.createTx(genTx(5)).send(),
      this.manager.createTx(genTx(6)).send(),
      this.manager.createTx(genTx(7)).send(),
      this.manager.createTx(genTx(8)).send(),
      this.manager.createTx(genTx(9)).send(),
      this.manager.createTx(genTx(10)).send(),
    ])
  }).timeout(600000)
}

describe('TxManager.default', () => {
  before(async () => {
    const provider = new providers.JsonRpcProvider(RPC_URL)
    const options = { ...defaultOptions }
    const { name, chainId } = await provider.getNetwork()
    options.chainId = chainId
    console.log('\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})

// describe('TxManager.EthersProvider', () => {
//   before(async () => {
//     const provider = new providers.JsonRpcProvider(RPC_URL)
//     const options = { ...defaultOptions }
//     const { name, chainId } = await provider.getNetwork()
//     options.rpcUrl = undefined
//     options.chainId = chainId
//     options.provider = provider
//     console.log('\n\n', 'network', { name, chainId }, '\n\n')
//     this.manager = new TxManager(options)
//   })
//   describe('#transaction', transactionTests)
// })

describe('TxManager.Web3Provider', () => {
  before(async () => {
    const provider = new providers.JsonRpcProvider(RPC_URL)
    const options = { ...defaultOptions }
    const { name, chainId } = await provider.getNetwork()
    options.rpcUrl = undefined
    options.chainId = chainId
    options.provider = new providers.Web3Provider(new Web3.providers.HttpProvider(RPC_URL))
    console.log('\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})
