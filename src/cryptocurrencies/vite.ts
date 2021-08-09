import { Platform, tokenIds } from "../common/constants";
import Address, { IAddress } from "../models/Address";
import * as vite from "@vite/vitejs";
import WS_RPC from "@vite/vitejs-ws";
import { client } from "../discord";
import viteQueue from "./viteQueue";
import { convert, tokenNameToDisplayName } from "../common/convert";
import { parseDiscordUser } from "../discord/util";
import { retryAsync, wait } from "../common/util";

const skipBlocks = []
let promisesResolveSnapshotBlocks = []

const wsService = new WS_RPC(process.env.VITE_WS)
export const wsProvider = new vite.ViteAPI(wsService, async () => {
    const SnapshotBlockEvent = await wsProvider.subscribe("createSnapshotBlockSubscription")
    SnapshotBlockEvent.on(() => {
        for(let r of promisesResolveSnapshotBlocks){
            r()
        }
        promisesResolveSnapshotBlocks = []
    })
    const AccountBlockEvent = await wsProvider.subscribe("createAccountBlockSubscription")
    AccountBlockEvent.on(async (result) => {
        try{
            if(skipBlocks.includes(result[0].hash))return
            const block = await wsProvider.request("ledger_getAccountBlockByHash", result[0].hash)
            if(!block)return
            if(block.blockType !== 2)return
            const address = await Address.findOne({
                address: block.toAddress,
                network: "VITE"
            })
            if(!address)return
            if(skipBlocks.includes(result[0].hash))return
            skipBlocks.push(result[0].hash)

            await receive(address, block)
            skipBlocks.splice(skipBlocks.indexOf(block.hash), 1)
        }catch(err){
            console.error(err)
        }
    })
})

export function waitForNextSnapshotBlock(){
    return new Promise(r => {
        promisesResolveSnapshotBlocks.push(r)
    })
}

export async function receive(address:IAddress, block:any){
    // Ok, we received a deposit/tip
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    await viteQueue.queueAction(address.address, async () => {
        await retryAsync(async () => {
            const accountBlock = vite.accountBlock.createAccountBlock("receive", {
                address: address.address,
                sendBlockHash: block.hash
            })
            accountBlock.setProvider(wsProvider)
            .setPrivateKey(keyPair.privateKey)
            await accountBlock.autoSetPreviousAccountBlock()
            await accountBlock.PoW()
            await accountBlock.sign()
            await accountBlock.send()
        }, 3)
    })

    // Don't send dm on random coins, for now just tell for registered coins.
    if(!Object.values(tokenIds).includes(block.tokenInfo.tokenId))return
    
    const tokenName = Object.entries(tokenIds).find(e => e[1] === block.tokenInfo.tokenId)[0]
    const displayNumber = convert(
        block.amount, 
        "RAW", 
        tokenName
    )
    let text = `

View transaction on vitescan: https://vitescan.io/tx/${block.hash}`
    const sendingAddress = await Address.findOne({
        address: block.fromAddress,
        network: "VITE"
    })
    if(sendingAddress){
        const [id, platform] = sendingAddress.handles[0].split(".")
        let mention = "Unknown User"
        switch(platform){
            case "Discord": {
                const user = await parseDiscordUser(id)
                if(user){
                    mention = user.tag
                }
                break
            }
        }
        text = `You were tipped ${displayNumber} ${tokenNameToDisplayName(tokenName)} by ${mention} !`+text
    }else{
        text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were deposited in your account's balance !`+text
    }
    for(const handle of address.handles){
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
}

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

export async function sendVITE(seed: string, toAddress: string, amount: string, tokenId: string):Promise<string>{
    const keyPair = vite.wallet.deriveKeyPairByIndex(seed, 0)
    const fromAddress = vite.wallet.createAddressByPrivateKey(keyPair.privateKey)
    
    return await retryAsync(async (tries) => {
        try{
            const accountBlock = vite.accountBlock.createAccountBlock("send", {
                toAddress: toAddress,
                address: fromAddress.address,
                tokenId: tokenId,
                amount: amount
            })
            accountBlock.setProvider(wsProvider)
            .setPrivateKey(keyPair.privateKey)
            await accountBlock.autoSetPreviousAccountBlock()
            await accountBlock.PoW()
            await accountBlock.sign()
        
            return (await accountBlock.send()).hash
        }catch(err){
            if(tries !== 300){
                await wait(10000)
                await waitForNextSnapshotBlock()
            }
            throw err
        }
    }, 301)
}

export async function getBalances(address: string){
    const result = await wsProvider.request("ledger_getAccountInfoByAddress", address)
    // Just in case
    if(!result)throw new Error("No result for this address")
    const balances:{
        [tokenId: string]: string
    } = {
        [tokenIds.VITC]: "0"
    }
    for(const tokenId in result.balanceInfoMap){
        balances[tokenId] = result.balanceInfoMap[tokenId].balance
    }
    return balances
}

(async () => {
    // Start of the code ! Time to receive as most transactions as possible !
    const addresses = await Address.find()
    for(const address of addresses){
        // eslint-disable-next-line no-constant-condition
        while(true){
            const shouldStop = await (async () => {
                const blocks = await wsProvider.request(
                    "ledger_getUnreceivedBlocksByAddress",
                    address.address,
                    0,
                    10
                )
                if(blocks.length === 0)return true
                for(const block of blocks){
                    if(skipBlocks.includes(block.hash))continue
                    skipBlocks.push(block.hash)
            
                    await receive(address, block)
                    skipBlocks.splice(skipBlocks.indexOf(block.hash), 1)
                }
                if(blocks.length !== 10)return true
                return false
            })()
            if(shouldStop)break
        }
    }
})()