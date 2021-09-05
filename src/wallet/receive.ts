import Address, { IAddress } from "../models/Address"
import { wsProvider } from "./node"
import * as vite from "@vite/vitejs"
import viteQueue from "./viteQueue"
import BigNumber from "bignumber.js"
import events from "./events"
import { wait } from "../common/util"
import { PoWDone, waitPoW } from "./powQueue"

const skipBlocks = new Set()

export async function onNewAccountBlock(hash: string){
    if(skipBlocks.has(hash))return
    skipBlocks.add(hash)
    try{
        await (async () => {
            const block = await wsProvider.request("ledger_getAccountBlockByHash", hash)
            if(!block)return
            if(block.blockType !== 2)return
            const address = await Address.findOne({
                address: block.toAddress,
                network: "VITE"
            })
            if(!address)return
            await receive(block, address)
        })()
    }catch(err){
        skipBlocks.delete(hash)
        throw err
    }
    skipBlocks.delete(hash)
}
export async function receive(block: any, address: IAddress){
    // Ok, we received a deposit/tip
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    const hash = await viteQueue.queueAction(address.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("receive", {
            address: address.address,
            sendBlockHash: block.hash
        })
        accountBlock.setProvider(wsProvider)
        .setPrivateKey(keyPair.privateKey)
        await accountBlock.autoSetPreviousAccountBlock()
        const quota = await wsProvider.request("contract_getQuotaByAccount", address.address)
        const availableQuota = new BigNumber(quota.currentQuota).div(21000)
        if(availableQuota.isLessThan(1)){
            await Promise.all([
                accountBlock.PoW(),
                waitPoW(block.toAddress)
            ])
            PoWDone(block.toAddress)
        }
        await accountBlock.sign()
        return await accountBlock.send()
    })

    events.emit("receive_transaction", {
        type: "receive",
        from: block.fromAddress,
        to: block.toAddress,
        hash: hash,
        from_hash: block.hash
    })
}