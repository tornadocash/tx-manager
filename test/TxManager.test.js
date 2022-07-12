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

const getOptions = async () => {
  const provider = new providers.JsonRpcProvider(RPC_URL)
  const network = await provider.getNetwork()
  const options = { ...defaultOptions }
  return { network, provider, options }
}

const sendTx = async tx => {
  const receipt = await tx
    .send()
    .on('transactionHash', hash => console.log('hash', hash))
    .on('mined', receipt => console.log('Mined in block', receipt.blockNumber))
    .on('confirmations', confirmations => console.log('confirmations', confirmations))
  console.log('receipt', receipt)
  return receipt
}

const transactionTests = () => {
  it('should work legacy tx', async () => {
    const tx = this.manager.createTx(tx1)
    const receipt = await sendTx(tx)
    receipt.type.should.equal(0)
  })

  it('should work eip-1559 tx', async () => {
    const tx = this.manager.createTx(tx5)
    const receipt = await sendTx(tx)
    receipt.type.should.equal(2)
  })

  it('should fetch gas params', async () => {
    const tx = this.manager.createTx(tx4)
    await sendTx(tx)
  })

  it('should bump gas params', async () => {
    const tx = this.manager.createTx(tx2)
    await sendTx(tx)
  })

  it('should cancel', async () => {
    const currentNonce = await this.manager._wallet.getTransactionCount('latest')
    const tx = this.manager.createTx(tx3)
    setTimeout(() => tx.cancel(), 1000)
    const receipt = await sendTx(tx)
    const transaction = await this.manager._provider.getTransaction(receipt.transactionHash)
    transaction.value.toNumber().should.equal(0)
    transaction.nonce.should.equal(currentNonce)
  })

  it('should replace', async () => {
    const currentNonce = await this.manager._wallet.getTransactionCount('latest')
    const tx = this.manager.createTx(tx3)
    setTimeout(() => tx.replace(tx4), 1000)
    const receipt = await sendTx(tx)
    const transaction = await this.manager._provider.getTransaction(receipt.transactionHash)
    receipt.to.should.equal(tx4.to)
    transaction.nonce.should.equal(currentNonce)
  })

  it('should increase nonce', async () => {
    const currentNonce = await this.manager._wallet.getTransactionCount('latest')
    this.manager._nonce = currentNonce - 1
    const tx = this.manager.createTx(tx4)
    await sendTx(tx)
  })

  it('should disable eip-1559 transactions', async () => {
    this.manager.config.ENABLE_EIP1559 = false
    const tx = this.manager.createTx(tx3)
    const receipt = await sendTx(tx)
    receipt.type.should.equal(0)
    this.manager.config.ENABLE_EIP1559 = true
  })

  it('should send multiple txs', async () => {
    const genTx = value => ({
      value,
      to: '0x0039F22efB07A647557C7C5d17854CFD6D489eF3',
    })
    await Promise.all(Array.from({ length: 10 }).map(n => this.manager.createTx(genTx(n + 1)).send()))
  }).timeout(600000)
}

describe('TxManager.default', () => {
  before(async () => {
    const {
      network: { name, chainId },
      options,
    } = await getOptions()
    options.chainId = chainId
    console.log('default\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})

describe('TxManager.EtherscanProvider', () => {
  before(async () => {
    const {
      network: { name, chainId },
      options,
    } = await getOptions()
    options.chainId = chainId
    options.provider = new providers.EtherscanProvider(chainId, process.env.ETHERSCAN_API_KEY)
    console.log('EtherscanProvider\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})

describe('TxManager.AlchemyProvider', () => {
  before(async () => {
    const {
      network: { name, chainId },
      options,
    } = await getOptions()
    options.chainId = chainId
    options.provider = new providers.AlchemyProvider(chainId, process.env.ALCHEMY_API_KEY)
    console.log('AlchemyProvider\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})

describe('TxManager.InfuraProvider', () => {
  before(async () => {
    const {
      network: { name, chainId },
      options,
    } = await getOptions()
    options.chainId = chainId
    options.provider = new providers.InfuraProvider(chainId, process.env.INFURA_API_KEY)
    console.log('InfuraProvider\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})

describe('TxManager.Web3Provider', () => {
  before(async () => {
    const {
      network: { name, chainId },
      options,
    } = await getOptions()
    options.chainId = chainId
    options.provider = new providers.Web3Provider(new Web3.providers.HttpProvider(RPC_URL))
    console.log('Web3Provider\n\n', 'network', { name, chainId }, '\n\n')
    this.manager = new TxManager(options)
  })
  describe('#transaction', transactionTests)
})
