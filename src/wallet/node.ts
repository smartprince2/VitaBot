import WS_RPC from "@vite/vitejs-ws";
import * as vite from "@vite/vitejs";
import { onNewAccountBlock } from "./receive";
import BigNumber from "bignumber.js"
import { getCurrentCycle } from "./cycle";
import { IAddress } from "../models/Address";
import PendingTransaction from "../models/PendingTransaction";
import { processBulkTransactions } from "./send";
import { waitPow } from "./powqueue";

export const availableNodes = [
    ...new Set([
        process.env.VITE_WS,
        "wss://vitanode.lightcord.org/ws",
        "wss://node-tokyo.vite.net/ws"
    ])
]

export const tokenIds = {
    // did you know it was pronounced veet ?
    VITE: "tti_5649544520544f4b454e6e40",
    ATTOV: "tti_5649544520544f4b454e6e40",
    // The healthiest one
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    // 🍌🍌
    BAN: "tti_61f59e574f9f7babfe8908e5",
    // fast and feeless too
    NANO: "tti_29a2af20212b985e9d49e899",
    // ew
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    SATS: "tti_b90c9baffffc9dae58d1f33f",
    // what's the purpose of that one ?
    VX: "tti_564954455820434f494e69b5",
    // redeem merch I guess
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    // everything vite does, but with fees
    ETH: "tti_687d8a93915393b219212c73"
}
export const tokenTickers = {
    tti_5649544520544f4b454e6e40: "VITE",
    tti_22d0b205bed4d268a05dfc3c: "VITC",
    tti_61f59e574f9f7babfe8908e5: "BAN",
    tti_29a2af20212b985e9d49e899: "NANO",
    tti_b90c9baffffc9dae58d1f33f: "BTC",
    tti_564954455820434f494e69b5: "VX",
    tti_251a3e67a41b5ea2373936c8: "VCP",
    tti_e5750d3c5b3bb5a31b8ba637: "XMR",
    tti_687d8a93915393b219212c73: "ETH"
}

export const tokenDecimals = {
    VITE: 18,
    ATTOV: 0,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    SATS: 0,
    BTC: 8,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18
}

export const tokenNames = {
    VITE: "Vite",
    ATTOV: "Attov",
    VITC: "Vitamin Coin 💊",
    BAN: "Banano 🍌",
    NANO: "Nano",
    SATS: "Satoshi"
}

export let wsProvider
let lastNode

export function getLastUsedNode(){
    return lastNode
}

export async function init(){
    lastNode = availableNodes[0]
    console.info("[VITE] Connecting to "+availableNodes[0])
    // TODO: DO our own library, because vitejs isn't good.
    const wsService = new WS_RPC(availableNodes[0], 6e5, {
        protocol: "",
        headers: "",
        clientConfig: "",
        retryTimes: Infinity,
        retryInterval: 10000
    })
    await new Promise((resolve) => {
        wsProvider = new vite.ViteAPI(wsService, resolve)
    })
    console.log("[VITE] Connected to node")
    await registerEvents()
    
    try{
        await PendingTransaction.find()
        .populate("address")
        .exec()
        .then(processBulkTransactions)
    }catch(err){
        console.error(err)
    } 
}

let resolveTokens:()=>void
export const tokenPromise = new Promise<void>((resolve) => {
    resolveTokens = resolve
})

async function registerEvents(){
    await Promise.all([
        wsProvider.subscribe("createAccountBlockSubscription")
        .then(AccountBlockEvent => {
            AccountBlockEvent.on(async (result) => {
                try{
                    await onNewAccountBlock(result[0].hash)
                }catch(err){
                    console.error(err)
                }
            })
        }),
        (async () => {
            try{
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
                for(const token of tokens){
                    const symbol = `${token.tokenSymbol}-${"000".slice((token.index.toString()).length)+token.index}`
                    tokenNames[symbol] = token.tokenName
                    if(!tokenNames[token.tokenSymbol]){
                        tokenNames[token.tokenSymbol] = token.tokenName
                    }
                    if(!tokenIds[token.tokenSymbol]){
                        tokenIds[token.tokenSymbol] = token.tokenId
                        tokenDecimals[token.tokenSymbol] = token.decimals
                        if(!tokenTickers[token.tokenId]){
                            tokenTickers[token.tokenId] = token.tokenSymbol
                        }
                    }else{
                        if(!tokenTickers[token.tokenId]){
                            tokenTickers[token.tokenId] = symbol
                        }
                    }
                    if(tokenIds[token.tokenSymbol] === token.tokenId){
                        tokenNames[symbol] = token.tokenName
                    }
                    tokenDecimals[symbol] = token.decimals
                    tokenIds[symbol] = token.tokenId
                }
            }catch(err){
                // can't do anything better than report in console.
                console.error(err)
            }
            resolveTokens()
        })()
    ])
}

export async function fetchAccountBlocks(address:string, hash:string, tokenId:string, limit:number){
    return wsProvider.request("ledger_getAccountBlocks", address, hash, tokenId, limit)
}

export async function fetchAccountBlock(hash:string){
    return wsProvider.request("ledger_getAccountBlockByHash", hash)
}

export async function getVotedSBP(address:string):Promise<{
    blockProducerName: string,
    status: number,
    votes: {
        [address: string]: string
    }
}>{
    return wsProvider.request("contract_getVotedSBP", address)
}

export async function changeSBP(address:IAddress, name: string){
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    
    const accountBlock = vite.accountBlock.createAccountBlock("voteForSBP", {
        address: address.address,
        sbpName: name
    })
    accountBlock.setPrivateKey(keyPair.privateKey)
    await sendTX(address.address, accountBlock)
}

export async function getVotes(name:string):Promise<{
    total: string,
    votes: {
        [address:string]: string
    },
    name: string
}>{
    const list = await wsProvider.request("contract_getSBPVoteDetailsByCycle", ""+getCurrentCycle())
    const sbp = list.find(item => item.blockProducerName === name)
    return {
        total: sbp?.totalVotes || "0",
        votes: sbp?.addressVoteMap || {},
        name: sbp?.blockProducerName || name
    }
}

export async function getBalances(address:string):Promise<{
    [tokenId: string]: string
}>{
    const result = await wsProvider.request("ledger_getAccountInfoByAddress", address)

    const balances:{
        [tokenId: string]: string
    } = {}
    for(const tokenId in result.balanceInfoMap||{}){
        balances[tokenId] = result.balanceInfoMap[tokenId].balance
    }
    return balances
}

const cachedPreviousBlocks = new Map<string, {
    height: number,
    previousHash: string,
    timeout: NodeJS.Timeout
}>()
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
        await waitPow(() => accountBlock.PoW(difficulty.difficulty))
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