import BigNumber from "bignumber.js";
import Address from "../../models/Address";
import { AmountError, BalanceError } from "../errors";
import { getBalances, tokenIds } from "../node";
import { send } from "../send";
import { AddressValidator, AmountValidator, TokenIdValidator, WalletAddressValidator } from "../types";
import viteQueue from "../viteQueue";

export default async function sendAction(fromAddress: string, toAddress: string, amount: string, tokenId: string){
    await WalletAddressValidator.validateAsync(fromAddress)
    await AddressValidator.validateAsync(toAddress)
    await AmountValidator.validateAsync(amount)
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

    const tx = await viteQueue.queueAction(fromAddress, async () => {
        const balances = await getBalances(fromAddress)
        const balance = new BigNumber(balances[tokenId] || "0")
        const amountRaw = new BigNumber(amount)
        if(amountRaw.isEqualTo(0)){
            throw new AmountError("Amount is 0")
        }
        if(balance.isLessThan(amountRaw)){
            throw new BalanceError("Insufficient balance")
        }

        return send(address, toAddress, amount, tokenId)
    })

    return tx
}