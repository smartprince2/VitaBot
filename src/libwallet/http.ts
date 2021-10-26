import fetch from "node-fetch"
import { ReceiveTransaction, SBPMessageStats, SendTransaction } from "../wallet/events"

export type GetTokenResponse = {
    token_ids: {
        [ticker:string]: string
    },
    token_names: {
        [ticker:string]: string
    },
    token_tickers: {
        [token_id:string]: string
    },
    token_decimals: {
        [ticker:string]: string
    }
}

export type BulkSendResponse = [
    [
        SendTransaction,
        ReceiveTransaction
    ],
    SendTransaction[]
]

export type GetBalancesResponses = {
    [tokenId: string]: string
}

export type SendResponse = SendTransaction

export type GetAccountBlockResponse = any
export type GetAccountBlocksResponse = GetAccountBlockResponse[]

export type GetSBPVotesResponse = {
    blockProducerName: string,
    status: string,
    votes: {
        [address: string]: string
    }
}

export type SendSBPMessagesResponse = Record<string, never>

export type GetSBPRewardsPendingWithdrawalResponse = {
    blockProducingReward: string,
    votingReward: string,
    totalReward: string,
    producedBlocks: string,
    targetBlocks: string,
    allRewardWithdrawed: boolean
}

export interface WalletResponses {
    bulk_send: BulkSendResponse,
    get_balances: GetBalancesResponses,
    get_tokens: GetTokenResponse,
    send: SendResponse,
    get_account_block: GetAccountBlockResponse,
    get_account_blocks: GetAccountBlocksResponse,
    get_sbp_votes: GetSBPVotesResponse,
    send_sbp_messages: SendSBPMessagesResponse,
    get_sbp_rewards_pending_withdrawal: GetSBPRewardsPendingWithdrawalResponse,
    withdraw_sbp_rewards: SendResponse
}

export interface WalletRequestParams {
    bulk_send: [string, [string, string][], string],
    get_balances: [string],
    get_tokens: [],
    send: [string, string, string, string],
    get_account_block: [string],
    get_account_blocks: [string, string, string, number],
    get_sbp_votes: [string],
    send_sbp_messages: [SBPMessageStats],
    get_sbp_rewards_pending_withdrawal: [string],
    withdraw_sbp_rewards: [string, string, string]
}

export async function requestWallet<Action extends keyof WalletResponses>(action:Action, ...params: WalletRequestParams[Action]):Promise<WalletResponses[Action]>{
    const res = await fetch("http://127.0.0.1:"+process.env.WALLET_PORT, {
        headers: {
            Authorization: process.env.WALLET_API_KEY
        },
        method: "post",
        body: JSON.stringify({
            action,
            params
        })
    })
    const body = await res.json()
    if("error" in body){
        const err = Error()
        err.message = body.error.message
        err.name = body.error.name
        throw err
    }
    return body
}