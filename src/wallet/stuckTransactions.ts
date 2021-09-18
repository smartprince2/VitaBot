import Address from "../models/Address"
import { wsProvider, tokenTickers } from "./node"
import asyncPool from "tiny-async-pool";
import { wait } from "../common/util";
import { receive, skipReceiveBlocks } from "./receive";

export default async function initStuckTransactionService():Promise<never>{
    // eslint-disable-next-line no-constant-condition
    while(true){
        await searchStuckTransactions()
    }
}
export async function searchStuckTransactions(){
    const addresses = await Address.find()
    const tokens = Object.keys(tokenTickers)
    await asyncPool(50, addresses, async address => {
        try{
            // eslint-disable-next-line no-constant-condition
            while(true){
                const shouldStop = await (async () => {
                    const blocks = await wsProvider.request(
                        "ledger_getUnreceivedBlocksByAddress",
                        address.address,
                        0,
                        20
                    )
                    if(blocks.length === 0)return true
                    for(const block of blocks.sort((b1, b2) => {
                        if(b1.tokenId === b2.tokenId){
                            const diff = BigInt(b1.amount)-BigInt(b2.amount)
                            if(diff < 0n){
                                return -1
                            }else if(diff === 0n){
                                return 0
                            }else if(diff > 0n){
                                return 1
                            }
                        }else{
                            const i1 = tokens.indexOf(b1.tokenId)
                            const i2 = tokens.indexOf(b2.tokenId)
                            if(i1 === i2)return 0
                            if(i1 < 0)return -1
                            if(i2 < 0)return 1
                            return i2-i1
                        }
                    })){
                        if(skipReceiveBlocks.has(block.hash))continue
                        skipReceiveBlocks.add(block.hash)

                        console.log("Stuck transaction found:", block.hash, "for", address.address)
                
                        await receive(block, address)
                        skipReceiveBlocks.delete(block.hash)
                    }
                    return false
                })()
                if(shouldStop)break
            }
        }catch(err){
            console.error(err)
        }
    })
    await wait(10000)
}