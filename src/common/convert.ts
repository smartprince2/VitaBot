import BigNumber from "bignumber.js"
import { tokenDecimals, tokenNames, tokenTickers } from "./constants"

export function tokenIdToName(tokenId:string){
    return tokenTickers[tokenId]
}

export function convert(amount: string|BigNumber|number, base_unit: string, unit: string){
    const value = new BigNumber(amount)
        .shiftedBy(tokenDecimals[base_unit]||0)
        .shiftedBy(-tokenDecimals[unit]||0)
    const toFixed = value.toFixed()
    return toFixed
}

export function tokenNameToDisplayName(token: string){
    token = tokenIdToName(token) || token

    return tokenNames[token] || token
}