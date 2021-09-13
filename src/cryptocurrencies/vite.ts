import { Platform, tokenDecimals, tokenIds, tokenNames } from "../common/constants";
import Address, { IAddress } from "../models/Address";
import * as vite from "vitejs-notthomiz";
import WS_RPC from "vitejs-notthomiz-ws";
import { client } from "../discord";
import viteQueue from "./viteQueue";
import { convert, tokenNameToDisplayName } from "../common/convert";
import { parseDiscordUser } from "../discord/util";
import { durationUnits, wait } from "../common/util";
import BigNumber from "bignumber.js";
import PendingTransaction, { IPendingTransactions } from "../models/PendingTransaction";
import { EventEmitter } from "events";
import asyncPool from "tiny-async-pool";
import Giveaway from "../models/Giveaway";

export const viteEvents = new EventEmitter()

const skipBlocks = []
const hashToSender = {}

const wsService = new WS_RPC(process.env.VITE_WS, 6e5, {
    protocol: "",
    headers: "",
    clientConfig: "",
    retryTimes: Infinity,
    retryInterval: 10000
})

export const wsProvider = new vite.ViteAPI(wsService, async () => {
    await Promise.all([
        (async () => {
            const AccountBlockEvent = await wsProvider.subscribe("createAccountBlockSubscription")
            AccountBlockEvent.on(async (result) => {
                try{
                    if(skipBlocks.includes(result[0].hash))return
                    const block = await wsProvider.request("ledger_getAccountBlockByHash", result[0].hash)
                    if(!block)return
                    if(block.blockType !== 2)return
                    if(block.amount === "0")return
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
        })(),
        (async () => {
            let page = 0
            const pageSize = 100
            let tokens = []
            // eslint-disable-next-line no-constant-condition
            while(true){
                const tokensInfo = await wsProvider.request("contract_getTokenInfoList", page, pageSize)
                page++
                tokens.push(...tokensInfo.tokenInfoList)
                if(tokensInfo.tokenInfoList.length != pageSize)break
            }
            tokens = tokens.sort((a, b) => a.index-b.index)
            for(const token of tokens
                .filter(token => {
                    if(
                        tokens.find(e => e.tokenSymbol === token.tokenSymbol)
                        !== token
                    )return false
                    return true
                })
            ){
                if(tokenNames[token.tokenSymbol])continue
                tokenNames[token.tokenSymbol] = token.tokenName
                if(tokenIds[token.tokenSymbol])continue
                tokenIds[token.tokenSymbol] = token.tokenId
                tokenDecimals[token.tokenSymbol] = token.decimals
            }
        })()
    ])
})

const cachedPreviousBlocks = new Map<string, {
    timeout: NodeJS.Timeout,
    height: number,
    previousHash: string
}>()

const VITE_TOKEN = "tti_5649544520544f4b454e6e40"
const SBP_NAME = "VitaminCoinSBP"
const skipSBPCheck = new Set<string>()

export async function receive(address:IAddress, block:any){
    // Ok, we received a deposit/tip
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    await viteQueue.queueAction(address.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("receive", {
            address: address.address,
            sendBlockHash: block.hash
        })
        accountBlock.setPrivateKey(keyPair.privateKey)
        await sendTX(address.address, accountBlock)
    })

    viteEvents.emit("receive_"+block.hash)

    if(block.tokenInfo.tokenId === VITE_TOKEN && !skipSBPCheck.has(address.address)){
        skipSBPCheck.add(address.address)
        viteQueue.queueAction(address.address, async () => {
            // lmao vote for Vitamin Coin SBP
            const sbpData = await wsProvider.request("contract_getVotedSBP", address.address)
            if(sbpData?.blockProducerName !== SBP_NAME){
                // we set it as vitamincoin sbp lol
                const accountBlock = vite.accountBlock.createAccountBlock("voteForSBP", {
                    address: address.address,
                    sbpName: SBP_NAME
                })
                accountBlock.setPrivateKey(keyPair.privateKey)
                await sendTX(address.address, accountBlock)
            }
        }).catch(console.error)
    }

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
        const [id, platform, sendingVariant] = sendingAddress.handles[0].split(".")
        const [,,variant] = address.handles[0].split(".")
        switch(sendingVariant){
            case "Giveaway": 
                text = `You won ${displayNumber} ${tokenNameToDisplayName(tokenName)} from a Giveaway!`+text
            break
            default: {
                let mention = "Unknown User"
                switch(platform){
                    case "Quota": {
                        //let's try to resolve the original id
                        const sender = hashToSender[block.hash]
                        if(!sender)break
                        delete hashToSender[block.hash]
                        const id = sender.split(".")[0]
                        const user = (await parseDiscordUser(id))[0]
                        if(user)mention = user.tag
                        break
                    }
                    case "Discord": {
                        const user = (await parseDiscordUser(id))[0]
                        if(!user)break
                        mention = user.tag
                        break
                    }
                    case "Faucet":{
                        mention = "Faucet"
                    }
                }
                switch(variant){
                    case "Giveaway": 
                        text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were locked for a giveaway.`+text
                    break
                    case "Airdrop": 
                        text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were locked for an airdrop.`+text
                    break
                    default: 
                        text = `You were tipped ${displayNumber} ${tokenNameToDisplayName(tokenName)} by ${mention}!`+text
                }
            }
        }
    }else{
        text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were deposited in your account's balance!`+text
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
        // address doesn't exist in db, create it
        const wallet = vite.wallet.createWallet()
        const addr = wallet.deriveAddress(0)
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

let botAddress:IAddress
export async function bulkSend(from: IAddress, recipients: string[], amount: string, tokenId: string){
    if(!botAddress)botAddress = await viteQueue.queueAction("Batch.Quota", () => getVITEAddressOrCreateOne("Batch", "Quota"))
    if(from.paused)throw new Error("Address frozen, please contact an admin.")
    const hash = await sendVITE(from.seed, botAddress.address, new BigNumber(amount).times(recipients.length).toFixed(), tokenId)
    await new Promise(r => {
        viteEvents.once("receive_"+hash, r)
    })
    const transactions = await rawBulkSend(botAddress, recipients, amount, tokenId, from.handles[0])
    return await Promise.all([
        Promise.resolve(hash),
        processBulkTransactions(transactions)
    ])
}

export async function processBulkTransactions(transactions:IPendingTransactions[]){
    const hashes = []
    while(transactions[0]){
        const transaction = transactions.shift()
        const hash = await viteQueue.queueAction(transaction.address.address, async () => {
            return sendVITE(transaction.address.seed, transaction.toAddress, transaction.amount, transaction.tokenId)
        })
        hashToSender[hash] = transaction.handle
        await transaction.delete()
        hashes.push(hash)
    }
    return hashes
}

export async function rawBulkSend(from: IAddress, recipients: string[], amount: string, tokenId: string, handle: string){
    const promises:Promise<IPendingTransactions>[] = []
    for(const recipient of recipients){
        promises.push(PendingTransaction.create({
            network: "VITE",
            address: from,
            toAddress: recipient,
            handle,
            amount,
            tokenId
        }))
    }
    return Promise.all(promises)
}

export async function sendTX(address:string, accountBlock:any):Promise<string>{
    accountBlock.setProvider(wsProvider)

    const [
        quota,
        difficulty
    ] = await Promise.all([
        wsProvider.request("contract_getQuotaByAccount", address),
        (async () => {
            if(cachedPreviousBlocks.has(address)){
                const block = cachedPreviousBlocks.get(address)
                accountBlock.setHeight((block.height).toString())
                accountBlock.setPreviousHash(block.previousHash)
            }else{
                await accountBlock.autoSetPreviousAccountBlock()
                const block = {
                    timeout: null,
                    height: parseInt(accountBlock.height),
                    previousHash: accountBlock.previousHash
                }
                cachedPreviousBlocks.set(address, block)
            }
        })()
        .then(() => wsProvider.request("ledger_getPoWDifficulty", {
            address: accountBlock.address,
            previousHash: accountBlock.previousHash,
            blockType: accountBlock.blockType,
            toAddress: accountBlock.toAddress,
            data: accountBlock.data
        })) as Promise<{
            requiredQuota: string;
            difficulty: string;
            qc: string;
            isCongestion: boolean;
        }>
    ])
    const availableQuota = new BigNumber(quota.currentQuota)
    if(availableQuota.isLessThan(difficulty.requiredQuota)){
        await accountBlock.PoW(difficulty.difficulty)
    }
    await accountBlock.sign()
    
    const hash = (await accountBlock.send()).hash
    const pblock = cachedPreviousBlocks.get(address) || {} as any
    pblock.height++
    pblock.previousHash = hash
    const timeout = pblock.timeout = setTimeout(() => {
        const block = cachedPreviousBlocks.get(address)
        if(timeout !== block.timeout)return
        cachedPreviousBlocks.delete(address)
    }, 600000)
    cachedPreviousBlocks.set(address, pblock)
    return hash
}

export async function sendVITE(seed: string, toAddress: string, amount: string, tokenId: string):Promise<string>{
    const keyPair = vite.wallet.deriveKeyPairByIndex(seed, 0)
    const address = vite.wallet.createAddressByPrivateKey(keyPair.privateKey)

    const accountBlock = vite.accountBlock.createAccountBlock("send", {
        toAddress: toAddress,
        address: address.address,
        tokenId: tokenId,
        amount: amount
    })
    accountBlock.setPrivateKey(keyPair.privateKey)
    return sendTX(address.address, accountBlock)
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

export async function searchStuckGiveaways(){
    await wait(10*durationUnits.m)
    return
    const addresses = await Address.find({
        handles: {
            $regex: /^\d\.Discord\.Giveaway$/
        }
    })
    await asyncPool(25, addresses, async address => {
        const giveaway = await Giveaway.find
    })
}

export async function searchStuckTransactions(){
    const addresses = await Address.find()
    const tokens = Object.values(tokenIds)
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
                        if(skipBlocks.includes(block.hash))continue
                        skipBlocks.push(block.hash)

                        console.log("Stuck transaction found:", block.hash, "for", address.address)
                
                        await receive(address, block)
                        skipBlocks.splice(skipBlocks.indexOf(block.hash), 1)
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

(async () => {
    // Start of the code! 
    await Promise.all([
        (async () => {
            // Send tips/rains that are stuck
            try{
                await PendingTransaction.find()
                .populate("address")
                .exec()
                .then(processBulkTransactions)
            }catch(err){
                console.error(err)
            }
        })(),
        (async () => {
            // receive stuck tranactions
            // eslint-disable-next-line no-constant-condition
            while(true){
                await searchStuckTransactions()
            }
        })(),
        (async () => {
            // Empty stuck giveaways
            // eslint-disable-next-line no-constant-condition
            while(true){
                await searchStuckGiveaways()
            }
        })()
    ])
})()
