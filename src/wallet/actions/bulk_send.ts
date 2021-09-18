import BigNumber from "bignumber.js";
import Address from "../../models/Address";
import { AmountError, BalanceError } from "../errors";
import { getBalances, tokenIds } from "../node";
import { bulkSend } from "../send";
import { AddressValidator, AmountValidator, TokenIdValidator, WalletAddressValidator } from "../types";
import viteQueue from "../viteQueue";
import Joi from "joi";

export default async function bulkSendAction(fromAddress: string, payouts: [string, string][], tokenId: string){
    await WalletAddressValidator.validateAsync(fromAddress)
    await Joi.array().items(
        Joi.array().items(
            Joi.any()
        ).required().length(2)
    ).required().validateAsync(payouts)
    try{
        await TokenIdValidator.validateAsync(tokenId.toLowerCase())
    }catch{
        tokenId = tokenId.toUpperCase()
        if(tokenIds[tokenId]){
            tokenId = tokenIds[tokenId]
        }
        await TokenIdValidator.validateAsync(tokenId)
    }
    
    const address = await Address.findOne({
        address: fromAddress
    })

    if(!address)throw new Error("from address not found.")

    const txs = await viteQueue.queueAction(fromAddress, async () => {
        const balances = await getBalances(fromAddress)
        const balance = new BigNumber(balances[tokenId] || "0")
        let amountRaw = new BigNumber(0)
        for(const payout of payouts){
            await AddressValidator.validateAsync(payout[0])
            await AmountValidator.validateAsync(payout[1])
            if(payout[1] === "0")continue
            amountRaw = amountRaw.plus(payout[1])
        }
        if(amountRaw.isEqualTo(0)){
            throw new AmountError("Amount is 0")
        }
        if(balance.isLessThan(amountRaw)){
            throw new BalanceError("Insufficient balance")
        }

        return bulkSend(address, payouts, tokenId)
    })

    return txs
}