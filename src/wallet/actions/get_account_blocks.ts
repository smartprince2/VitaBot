// Get account blocks by address, hash and tokenId

import Joi from "joi";
import { fetchAccountBlocks } from "../node";
import { AddressValidator, HashValidator, TokenIdValidator } from "../types";

export default async function getAccountBlocks(address:string, hash:string, tokenId:string, limit: number){
    await AddressValidator.validateAsync(address)
    if(hash){
        await HashValidator.validateAsync(hash)
    }else{
        hash = null
    }
    if(tokenId){
        await TokenIdValidator.validateAsync(tokenId)
    }else{
        tokenId = null
    }
    if(limit){
        await Joi.number().min(1).max(100).required().validateAsync(limit)
    }else{
        limit = 10
    }

    const blocks = await fetchAccountBlocks(address, hash, tokenId, limit)

    return blocks
}