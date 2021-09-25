import { Platform } from "../common/constants"
import Address, { IAddress } from "../models/Address"
import * as vite from "vitejs-notthomiz"

export function parseTransactionType(sendingHandle:string, transaction_handle:string){
    if(!sendingHandle){
        // outside of our wallet system,
        // looks like a deposit.
        return {
            type: "deposit",
            text: `**{amount}** were deposited in your account's balance!`
        }
    }

    const [sid, splatform, svariant] = sendingHandle.split(".")
    switch([splatform, svariant].filter(e=>!!e).join(".") as Platform){
        case "Discord.Giveaway": {
            return {
                type: "giveaway",
                text: `You won **{amount}** from a Giveaway!`
            }
        }
        case "Faucet": {
            return {
                type: "faucet",
                text: `You received **{amount}** from **Faucet**!`
            }
        }
        case "Discord":
        case "Twitter":
        case "Reddit": 
            // normal tips
            return {
                type: "tip",
                text: `You were tipped **{amount}** by **{mention}**!`,
                id: sid,
                platform: splatform
            }
        case "Rewards": {
            switch(sid){
                case "SBP": {
                    return {
                        type: "rewards",
                        text: `You received **{amount}** for voting for our SBP!`
                    }
                }
            }
            break
        }
        case "Quota": {
            if(!transaction_handle){
                return {
                    type: "unknown",
                    text: `You received a transaction of **{amount}** but the bot couldn't determine from whom.`
                }
            }
            return parseTransactionType(transaction_handle, null)
        }
        default: {
            return {
                type: "Unknown",
                text: `You received **{amount}** but the bot couldn't determine from whom.`
            }
        }
    }
}

const addressCache = new Map<string, IAddress>()

export async function getVITEAddress(id:string, platform:Platform):Promise<IAddress>{
    const address = await Address.findOne({
        network: "VITE",
        handles: `${id}.${platform}`
    })
    if(!address)throw new Error("Couldn't find an address in DB")
    return address
}

export async function getVITEAddressOrCreateOne(id:string, platform:Platform):Promise<IAddress>{
    const handle = `${id}.${platform}`
    if(addressCache.has(handle))return addressCache.get(handle)
    try{
        const address = await getVITEAddress(id, platform)
        addressCache.set(handle, address)
        return address
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
        addressCache.set(handle, address)
        return address
    }
}