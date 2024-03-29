import events, { ReceiveTransaction, SendTransaction } from "./events"
import * as vite from "@vite/vitejs"
import viteQueue from "./viteQueue"
import BigNumber from "bignumber.js"
import { IAddress } from "../models/Address"
import { sendTX } from "./node"
import { getVITEAddressOrCreateOne } from "./address"
import PendingTransaction, { IPendingTransactions } from "../models/PendingTransaction"
import { retryAsync } from "../common/util"

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
    const transactions = await rawBulkSend(botAddress, payouts, tokenId, from.handles[0], baseTransaction.hash)
    return await Promise.all([
        Promise.resolve([
            baseTransaction,
            receiveTransaction
        ]),
        processBulkTransactions(transactions)
    ])
}

export async function rawBulkSend(from: IAddress, payouts:[string, string][], tokenId: string, handle: string, hash: string){
    const promises:Promise<IPendingTransactions>[] = []
    for(const [to, amount] of payouts){
        promises.push(PendingTransaction.create({
            network: "VITE",
            address: from,
            toAddress: to,
            amount,
            tokenId,
            handle,
            hash
        }))
    }
    return Promise.all(promises)
}

export async function processBulkTransactions(transactions:IPendingTransactions[]):Promise<SendTransaction[]>{
    const txs:SendTransaction[] = []
    const errors = []
    while(transactions[0]){
        try{
            const transaction = transactions.shift()
            const baseTx = await viteQueue.queueAction(transaction.address.address, async () => {
                return retryAsync(() => {
                    return send(transaction.address, transaction.toAddress, transaction.amount, transaction.tokenId, Buffer.from(transaction.hash || "", "hex").toString("base64"))
                }, 3)
            })
            hashToSender[baseTx.hash] = transaction.handle
            setTimeout(() => {
                delete hashToSender[baseTx.hash]
            }, 600000)
            await transaction.delete()
            txs.push(baseTx)
        }catch(err){
            errors.push(err)
        }
    }
    if(errors.length > 0){
        throw errors
    }
    return txs
}