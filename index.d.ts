import { BigNumberish, providers, Wallet } from 'ethers'
import { EventEmitter } from 'eventemitter3'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import PromiEvent from 'web3-core-promievent'
import { GasPriceOracle } from 'gas-price-oracle'
import { Mutex } from 'async-mutex'
import { Options as GasOracleOptions } from 'gas-price-oracle/lib/types'

export interface TransactionData {
  to?: string
  from?: string
  nonce?: number
  gasLimit?: BigNumberish
  gasPrice?: BigNumberish
  data?: string
  value?: BigNumberish
  chainId?: number
  type?: number
  maxFeePerGas?: BigNumberish
  maxPriorityFeePerGas?: BigNumberish
}

export interface TxManagerConfig {
  MAX_RETRIES?: number
  GAS_BUMP_PERCENTAGE?: number
  MIN_GWEI_BUMP?: number
  GAS_BUMP_INTERVAL?: number
  MAX_GAS_PRICE?: number
  GAS_LIMIT_MULTIPLIER?: number
  POLL_INTERVAL?: number
  CONFIRMATIONS?: number
  ESTIMATE_GAS?: boolean
  THROW_ON_REVERT?: boolean
  BLOCK_GAS_LIMIT?: number
  PRIORITY_FEE_GWEI?: number
  BASE_FEE_RESERVE_PERCENTAGE?: number
}

export interface TxManagerParams {
  privateKey: string
  rpcUrl: string
  broadcastNodes?: string[]
  config?: TxManagerConfig
  gasPriceOracleConfig?: GasOracleOptions
}

export class TxManager {
  private _privateKey: string
  config: TxManagerConfig
  address: string
  _provider: providers.JsonRpcProvider
  _wallet: Wallet
  _broadcastNodes: string[]
  _gasPriceOracle: GasPriceOracle
  _mutex: Mutex
  _nonce: number

  constructor(params?: TxManagerParams)

  createTx(tx: TransactionData): Transaction
}

export type GasParams = {
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  gasPrice?: string
  type: number
}
export type TxManagerEvents = keyof MessageEvents

export type MessageEvents = {
  error: (error: Error) => void
  transactionHash: (transactionHash: string) => void
  mined: (receipt: TransactionReceipt) => void
  confirmations: (confirmations: number) => void
}
type TEventEmitter = typeof EventEmitter

declare interface TxManagerEventEmmiter extends TEventEmitter {
  on<U extends TxManagerEvents>(event: U, listener: MessageEvents[U]): this
  on(event: 'confirmations', listener: MessageEvents['confirmations']): Promise<TransactionReceipt>
  emit<U extends TxManagerEvents>(event: U, ...args: Parameters<MessageEvents[U]>): boolean
}

export class Transaction {
  manager: TxManager
  tx: TransactionData
  private _promise: typeof PromiEvent
  private _emitter: TxManagerEventEmmiter
  executed: boolean
  retries: number
  currentTxHash: string
  hashes: string[]

  constructor(tx: TransactionData, manager: TxManager)

  send(): TxManagerEventEmmiter

  replace(tx: TransactionData): Promise<void>

  cancel(): this

  private _prepare(): Promise<void>

  private _send(): Promise<void>

  private _execute(): Promise<TransactionReceipt>

  private _waitForConfirmations(): Promise<TransactionReceipt>

  private _getReceipts(): Promise<TransactionReceipt>

  private _increaseGasPrice(): boolean

  private _hasError(message: string, errors: (string | RegExp)[]): boolean

  private _getGasPrice(type: 'instant' | 'fast' | 'normal' | 'slow'): Promise<string>

  private _getLastNonce(): Promise<number>

  private _getGasParams(): Promise<GasParams>
}
