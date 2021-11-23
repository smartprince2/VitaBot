import * as vite from "@vite/vitejs"
import Joi from "joi"

export const AddressValidator = Joi.string().required().custom(address => {
    const type = vite.wallet.isValidAddress(address)
    if(type === vite.wallet.AddressType.Illegal){
        // not a valid address
        throw new TypeError("Invalid Address")
    }
    return address
})

export const SBPNameValidator = Joi.string().required().custom(name => {
    if(!vite.utils.isValidSBPName(name)){
        // not a valid address
        throw new TypeError("Invalid SBP Name")
    }
    return name
})

export const SmartContractAddressValidator = Joi.string().required().custom(address => {
    const type = vite.wallet.isValidAddress(address)
    if(type !== vite.wallet.AddressType.Contract){
        // not a valid address
        throw new TypeError("Invalid Smart Contract Address")
    }
    return address
})

export const WalletAddressValidator = Joi.string().required().custom(address => {
    const type = vite.wallet.isValidAddress(address)
    if(type !== vite.wallet.AddressType.Account){
        // not a valid address
        throw new TypeError("Invalid Wallet Address")
    }
    return address
})

export const HashValidator = Joi.string().required().pattern(/^[\dabcdef]{64}$/)

export const AmountValidator = Joi.string().required().pattern(/^\d+$/)
export const RawAmountValidator = Joi.string().required().pattern(/^\d+$/)

export const TokenIdValidator = Joi.string().required().custom(token => {
    if(!vite.utils.isValidTokenId(token))throw new TypeError("Invalid Token Id")
    return token
})