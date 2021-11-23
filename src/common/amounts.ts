import BigNumber from "bignumber.js"
import { tokenIds } from "./constants"
import { tokenPrices } from "./price"

export class InvalidAmountError extends Error {
    name = "InvalidAmountError"
}

export const multipliers = {
    k: 3,
    m: 6,
    b: 9,
    t: 12,
    q: 15
}

export function parseAmount(amount:string, currency:string){
    if(!amount)throw new InvalidAmountError("Couldn't parse amount")

    let fiat = null
    if(amount[0] === "$"){
        // dollar equivalent
        fiat = "USDT"
        amount = amount.slice(1)
    }else if(amount.slice(-1) === "$"){
        fiat = "USDT"
        amount = amount.slice(0, -1)
    }

    let multiplier = 0
    if(/[kmbtq]$/.test(amount.toLowerCase())){
        // so, for example, 3k vitc
        const unit = amount.slice(-1)
        amount = amount.slice(0, -1)
        multiplier = multipliers[unit]
    }
    
    if(!/^\d+(\.\d+)?$/.test(amount))throw new InvalidAmountError("Couldn't parse amount")
    let amountParsed = new BigNumber(amount)

    if(multiplier !== 0){
        amountParsed = amountParsed.shiftedBy(multiplier)
    }
    if(fiat && currency !== tokenIds[fiat]){
        const pair = tokenPrices[currency+"/"+tokenIds[fiat]]
        if(!pair)throw new InvalidAmountError("Couldn't resolve the fiat price of that asset.")
        amountParsed = amountParsed.div(pair.closePrice)
    }

    return amountParsed
}