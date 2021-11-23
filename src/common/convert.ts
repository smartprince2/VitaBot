import BigNumber from "bignumber.js"
import { discordEmojis, tokenDecimals, tokenNames, tokenTickers, twitterEmojis } from "./constants"

export function tokenIdToName(tokenId:string){
    return tokenTickers[tokenId]
}

export function convert(amount: string|BigNumber|number, base_unit: string, unit: string){
    const value = new BigNumber(amount)
        .shiftedBy(tokenDecimals[base_unit]||0)
        .shiftedBy(-tokenDecimals[unit]||0)
    let toFixed = value.toFixed(tokenDecimals[unit]||0)

    if(toFixed.includes(".")){
        toFixed = toFixed.replace(/\.?0+$/, "") || "0" 
    }

    return toFixed
}

const platform = require.main.filename.includes("discord") ? "discord" : require.main.filename.includes("twitter") ? "twitter" : "other"

export function tokenNameToDisplayName(token: string){
    token = tokenIdToName(token) || token

    const name = tokenNames[token] || token

    if(platform === "discord" && discordEmojis[token]){
        return `${name} ${discordEmojis[token]}`
    }else if(platform === "twitter" && twitterEmojis[token]){
        return `${name} ${twitterEmojis[token]}`
    }

    return name
}