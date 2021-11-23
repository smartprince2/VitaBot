import events, { ReceiveTransaction, SendTransaction } from "./events"
import * as vite from "@vite/vitejs"
import viteQueue from "./viteQueue"
import BigNumber from "bignumber.js"
import { IAddress } from "../models/Address"
import { cachedPreviousBlocks, sendTX, wsProvider } from "./node"
import { getVITEAddressOrCreateOne } from "./address"
import PendingTransaction, { IPendingTransactions } from "../models/PendingTransaction"
import { waitPow } from "./powqueue"

export const hashToSender:{[key:string]: string} = {}

export async function send(address: IAddress, toAddress: string, amount: string, tokenId: string, data?: string):Promise<SendTransaction>{
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    const accountBlock = vite.accountBlock.createAccountBlock("send", {
        toAddress: toAddress,
        address: address.address,
        tokenId: tokenId,
        amount: amount,
        data: data || undefined
    })
    accountBlock.setPrivateKey(keyPair.privateKey)
    const hash = await sendTX(address.address, accountBlock)

    const tx:SendTransaction = {
        type: "send" as const,
        from: address.address,
        to: toAddress,
        hash: hash,
        amount: amount,
        token_id: tokenId,
        sender_handle: address.handles[0]
    }
    events.emit("send_transaction", tx)

    return tx
}
        
let botAddress:IAddress
export async function bulkSend(from: IAddress, payouts:[string, string][], tokenId: string){
    if(!botAddress)botAddress = await viteQueue.queueAction("Batch.Quota", () => getVITEAddressOrCreateOne("Batch", "Quota"))
    if(from.paused)throw new Error("Address frozen, please contact an admin.")
    let totalAmount = new BigNumber(0)
    for(const payout of payouts){
        totalAmount = totalAmount.plus(payout[1])
    }
    const baseTransaction = await send(from, botAddress.address, totalAmount.toFixed(), tokenId)
    const receiveTransaction = await new Promise<ReceiveTransaction>(resolve => {
        const listener = (tx) => {
            if(tx.from_hash !== baseTransaction.hash)return
            events.off("receive_transaction", listener)
            resolve(tx)
        }
        events.on("receive_transaction", listener)
    })
    const transactions = await rawBulkSend(botAddress, payouts, tokenId, from.handles[0])
    return await Promise.all([
        Promise.resolve([
            baseTransaction,
            receiveTransaction
        ]),
        processBulkTransactions(transactions)
    ])
}

export async function rawBulkSend(from: IAddress, payouts:[string, string][], tokenId: string, handle: string){
    const promises:Promise<IPendingTransactions>[] = []
    for(const [to, amount] of payouts){
        promises.push(PendingTransaction.create({
            network: "VITE",
            address: from,
            toAddress: to,
            amount,
            tokenId,
            handle
        }))
    }
    return Promise.all(promises)
}

const usedQuotaPerTX = new BigNumber(21000)
export async function processBulkTransactions(transactions:IPendingTransactions[]):Promise<SendTransaction[]>{
    const txs:SendTransaction[] = []
    const address = transactions[0].address
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    
    await viteQueue.queueAction(address.address, async () => {
        cachedPreviousBlocks.delete(address.address)
        const [
            quota,
            previous
        ] = await Promise.all([
            wsProvider.request("contract_getQuotaByAccount", address.address),
            wsProvider.request("ledger_getLatestAccountBlock", address.address)
            .then(accountBlock => {
                return {
                    hash: accountBlock.hash,
                    height: accountBlock.height
                }
            })
        ])

        const powPromises = []
        let availableQuota = new BigNumber(quota.currentQuota)
        const blocks = []
        for(const transaction of transactions){
            const accountBlock = vite.accountBlock.createAccountBlock("send", {
                toAddress: transaction.toAddress,
                address: address.address,
                tokenId: transaction.tokenId,
                amount: transaction.amount
            })
            accountBlock.setPrivateKey(keyPair.privateKey)
            accountBlock.setHeight(previous.height)
            accountBlock.setPreviousHash(previous.hash)
            if(availableQuota.isLessThan(usedQuotaPerTX)){
                powPromises.push(waitPow(() => accountBlock.PoW("67108863")))
            }else{
                availableQuota = availableQuota.minus(usedQuotaPerTX)
            }
            await accountBlock.sign()
            blocks.push(accountBlock)
            const baseTx:SendTransaction = {
                type: "send" as const,
                from: address.address,
                to: transaction.toAddress,
                hash: accountBlock.hash,
                amount: transaction.amount,
                token_id: transaction.tokenId,
                sender_handle: address.handles[0]
            }
            hashToSender[baseTx.hash] = transaction.handle
            setTimeout(() => {
                delete hashToSender[baseTx.hash]
            }, 600000)
            events.emit("send_transaction", baseTx)
            txs.push(baseTx)
            previous.height = new BigNumber(previous.height).plus(1).toFixed()
            previous.hash = baseTx.hash
        }
        await Promise.all(powPromises)
        await wsProvider.batch(blocks.map(ab => {
            return {
                type: "request",
                methodName: "ledger_sendRawTransaction",
                params: [ab.accountBlock]
            }
        }))
        await PendingTransaction.deleteMany({
            $or: transactions.map(e => {
                return {
                    _id: e._id
                }
            })
        })
    })
    return txs
}