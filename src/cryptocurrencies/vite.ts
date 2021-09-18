import { Platform, tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../common/constants";
import Address, { IAddress } from "../models/Address";
import * as vite from "vitejs-notthomiz";
import { client } from "../discord";
import { convert, tokenNameToDisplayName } from "../common/convert";
import { parseDiscordUser } from "../discord/util";
import { durationUnits, wait } from "../common/util";
import asyncPool from "tiny-async-pool";
import Giveaway from "../models/Giveaway";
import { WebsocketConnection } from "../libwallet/ws";
import { GetTokenResponse, requestWallet } from "../libwallet/http";
import { ReceiveTransaction } from "../wallet/events";

const hashToSender = {}

export const walletConnection = new WebsocketConnection()

export async function receive(address:IAddress, block:ReceiveTransaction){
    // Don't send dm on random coins, for now just tell for registered coins.
    if(!(block.token_id in tokenTickers))return
    
    const tokenName = Object.entries(tokenIds).find(e => e[1] === block.token_id)[0]
    const displayNumber = convert(
        block.amount, 
        "RAW", 
        tokenName
    )
    let text = `

View transaction on vitescan: https://vitescan.io/tx/${block.hash}`
    const sendingAddress = await Address.findOne({
        address: block.from,
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

(async () => {
    await walletConnection.connect()
    const tokens:GetTokenResponse = await requestWallet("get_tokens")
    
    for(const ticker in tokens.token_decimals){
        tokenDecimals[ticker] = tokens.token_decimals[ticker]
    }
    for(const ticker in tokens.token_ids){
        tokenIds[ticker] = tokens.token_ids[ticker]
    }
    for(const ticker in tokens.token_names){
        tokenNames[ticker] = tokens.token_names[ticker]
    }
    for(const tokenId in tokens.token_tickers){
        tokenTickers[tokenId] = tokens.token_tickers[tokenId]
    }
    // Start of the code! 
    await Promise.all([
        (async () => {
            // Empty stuck giveaways
            // eslint-disable-next-line no-constant-condition
            while(true){
                await searchStuckGiveaways()
            }
        })()
    ])
})()
