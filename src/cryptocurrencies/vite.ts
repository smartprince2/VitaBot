import { Platform, tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../common/constants";
import Address, { IAddress } from "../models/Address";
import * as vite from "vitejs-notthomiz";
import { client } from "../discord";
import { convert, tokenNameToDisplayName } from "../common/convert";
import { parseDiscordUser } from "../discord/util";
import { durationUnits } from "../common/util";
import asyncPool from "tiny-async-pool";
import Giveaway from "../models/Giveaway";
import { WebsocketConnection } from "../libwallet/ws";
import { GetTokenResponse, requestWallet } from "../libwallet/http";
import lt from "long-timeout"
import GiveawayWinner from "../models/GiveawayWinner";

export const walletConnection = new WebsocketConnection()

walletConnection.on("tx", async transaction => {
    if(transaction.type !== "receive")return
    
    const address = await Address.findOne({
        address: transaction.to
    })
    // shouldn't happen but
    if(!address)return

    // Don't send dm on random coins, for now just tell for registered coins.
    if(!(transaction.token_id in tokenTickers))return
    
    const tokenName = tokenTickers[transaction.token_id]
    const displayNumber = convert(
        transaction.amount, 
        "RAW", 
        tokenName
    )
    let text = `

View transaction on vitescan: https://vitescan.io/tx/${transaction.hash}`
    const sendingAddress = await Address.findOne({
        address: transaction.from,
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
                        if(!transaction.sender_handle)return
                        const id = transaction.sender_handle.split(".")[0]
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
    const addresses = await Address.find({
        handles: {
            $regex: "^\\d+\\.Discord\\.Giveaway$"
        }
    })
    await asyncPool(25, addresses, async address => {
        const mess_id = address.handles[0].split(".")[0]
        const giveaway = await Giveaway.findOne({
            message_id: mess_id
        })
        if(giveaway)return

        const balances = await requestWallet("get_balances", address.address)
        const tokens = []
        for(const tokenId in balances){
            if(balances[tokenId] === "0")continue
            tokens.push(tokenId)
        }
        if(tokens.length === 0)return
        const winner = await GiveawayWinner.findOne({
            message_id: mess_id
        })
        let recipient = null
        if(!winner){
            // try to find the recipient address
            // by looking at send blocks
            const blocks = await requestWallet(
                "get_account_blocks",
                address.address,
                null,
                null,
                100
            )
            for(const block of blocks){
                // send block
                if(block.blockType !== 2)continue

                recipient = block.toAddress
                break
            }
            if(!recipient){
                console.warn(`Stuck giveaway account: ${address.address}`)
                return
            }
        }else{
            recipient = (await getVITEAddressOrCreateOne(winner.user_id, "Discord")).address
        }
        // we got the funds and the recipient, send it
        for(const token of tokens){
            await requestWallet(
                "send",
                address.address,
                recipient, 
                balances[token],
                token
            )
        }
    })
    await new Promise((resolve) => {
        lt.setTimeout(resolve, durationUnits.d)
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
