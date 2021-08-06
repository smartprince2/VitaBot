import { Platform, tokenIds } from "../common/constants";
import Address, { IAddress } from "../models/Address";
import * as vite from '@vite/vitejs';
import WS_RPC from "@vite/vitejs-ws";
import { client } from "../discord";
import viteQueue from "./viteQueue";
import BigNumber from "bignumber.js";

const wsService = new WS_RPC(process.env.VITE_WS)
export const wsProvider = new vite.ViteAPI(wsService, async () => {
    const event = await wsProvider.subscribe("createAccountBlockSubscription")
    event.on(async (result) => {
        try{
            const block = await wsProvider.request("ledger_getAccountBlockByHash", result[0].hash)
            if(!block)return
            if(block.tokenInfo.tokenId !== tokenIds.VITC)return
            if(block.blockType !== 2)return
            const address = await Address.findOne({
                address: block.toAddress,
                network: "VITE"
            })
            if(!address)return
            // Ok, we received a payment
            const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
            await viteQueue.queueAction(block.toAddress, async () => {
                const accountBlock = vite.accountBlock.createAccountBlock("receive", {
                    address: block.toAddress,
                    sendBlockHash: block.hash
                })
                accountBlock.setProvider(wsProvider)
                .setPrivateKey(keyPair.privateKey)
                await accountBlock.autoSetPreviousAccountBlock()
                await accountBlock.PoW()
                await accountBlock.sign()
                await accountBlock.send()
            })
            
            let displayNumber = new BigNumber(block.amount)
                .div(new BigNumber("1000000000000000000"))
                .toString()
            let text = `
        
View transaction on vitescan: https://vitescan.io/tx/${block.hash}`
            const sendingAddress = await Address.findOne({
                address: block.fromAddress,
                network: "VITE"
            })
            if(sendingAddress){
                let [id, platform] = sendingAddress.handles[0].split("")
                let mention = ""
                switch(platform){
                    case "Discord": {
                        mention = `<@${id}>`
                        break
                    }
                }
                text = `You were tipped ${displayNumber} VITC 💊 by ${mention} !`+text
            }else{
                text = `${displayNumber} VITC 💊 were added in your account's balance !`+text
            }
            for(let handle of address.handles){
                const [id, service] = handle.split(".")
                switch(service){
                    case "Discord": {
                        const user = client.users.cache.get(id)
                        if(!user)return
                        user.send(text).catch(()=>{})
                        break
                    }
                }
            }
        }catch(err){
            console.error(err)
        }
    })
})

export async function getVITEAddress(id:string, platform:Platform):Promise<IAddress>{
    const address = await Address.findOne({
        network: "VITE",
        handles: `${id}.${platform}`
    })
    if(!address)throw new Error("Couldn't find an address in DB")
    return address
}

export async function getVITEAddressOrCreateOne(id:string, platform:Platform):Promise<IAddress>{
    try{
        return await getVITEAddress(id, platform)
    }catch(err){
        const wallet = vite.wallet.createWallet()
        const addr = wallet.deriveAddress(0)
        // address doesn't exist in db, create it
        const address = await Address.create({
            network: "VITE",
            seed: wallet.seedHex,
            address: addr.address,
            handles: [
                `${id}.${platform}`
            ]
        })
        return address
    }
}

export async function sendVITC(seed: string, toAddress: string, amount: string){
    const keyPair = vite.wallet.deriveKeyPairByIndex(seed, 0)
    const fromAddress = vite.wallet.createAddressByPrivateKey(keyPair.privateKey)
    const result = await viteQueue.queueAction(fromAddress.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("send", {
            toAddress: toAddress,
            address: fromAddress.address,
            tokenId: tokenIds.VITC,
            amount: amount
        })
        accountBlock.setProvider(wsProvider)
        .setPrivateKey(keyPair.privateKey)
        await accountBlock.autoSetPreviousAccountBlock()
        await accountBlock.PoW()
        await accountBlock.sign()
        return await accountBlock.send()
    })
    return result.hash
}

export async function getBalances(address: string){
    return await viteQueue.queueAction(address, async () => {
        const result = await wsProvider.request("ledger_getAccountInfoByAddress", address)
        // Just in case
        if(!result)throw new Error("No result for this address")
        const balances:{
            [tokenId: string]: string
        } = {
            [tokenIds.VITC]: "0"
        }
        for(let tokenId in result.balanceInfoMap){
            balances[tokenId] = result.balanceInfoMap[tokenId].balance
        }
        return balances
    })
}