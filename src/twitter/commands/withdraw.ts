import { DMMessage, twitc } from "..";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import twitterqueue from "../twitterqueue";
import * as vite from "@vite/vitejs"
import { disabledTokens, tokenIds } from "../../common/constants";
import help from "./help";
import { isAddressOkayPrivate } from "../util";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import BigNumber from "bignumber.js"
import { convert, tokenNameToDisplayName } from "../../common/convert";

export default new class WithdrawCommand implements Command {
    public = false
    dm = true
    description = "Withdraw your funds from the tipbot"
    extended_description = `Withdraw your funds from the tipbot.

Examples:
Withdraw all your ${tokenNameToDisplayName("VITC")} to your wallet
    .withdraw all vite_addr
Withdraw 1 ${tokenNameToDisplayName("VITC")} to your wallet
    .withdraw 1 vite_addr
Withdraw all your ${tokenNameToDisplayName("BAN")} to your wallet
    .withdraw all BAN vite_addr
Withdraw 1 ${tokenNameToDisplayName("BAN")} to your wallet
    .withdraw 1 BAN vite_addr`
    alias = ["withdraw", "send"]
    usage = "<amount|all> {currency} <vite_addr>"

    async executePrivate(message:DMMessage, args:string[], command:string){
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            currencyOrRecipient,
            addr
        ] = args
        if(!amountRaw || !currencyOrRecipient)return help.executePrivate(message, [command])
        if(!/^\d+(\.\d+)?$/.test(amountRaw) && amountRaw !== "all")return help.executePrivate(message, [command])
        if(vite.wallet.isValidAddress(currencyOrRecipient)){
            // user here
            addr = currencyOrRecipient
            currencyOrRecipient = "vitc"
        }
        let isRawTokenId = false
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds)){
            if(vite.utils.isValidTokenId(currencyOrRecipient.toLowerCase())){
                isRawTokenId = true
                currencyOrRecipient = currencyOrRecipient.toLowerCase()
            }else{
                await twitc.v1.sendDm({
                    recipient_id: message.user.id,
                    text: `The token ${currencyOrRecipient} isn't supported. if you think this is an error from the bot, contact @NotThomiz.`
                })
                return
            }
        }
        if((tokenIds[currencyOrRecipient] in disabledTokens)){
            await twitc.v1.sendDm({
                recipient_id: message.user.id,
                text: `The token ${tokenNameToDisplayName(currencyOrRecipient)} is currently disabled, because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`
            })
        }
        if(!addr)return help.executePrivate(message, [command])
        if(!vite.wallet.isValidAddress(addr)){
            await twitc.v1.sendDm({
                recipient_id: message.user.id,
                text: `${addr} is not a valid vite address.`
            })
            return
        }

        const address = await twitterqueue.queueAction(message.user.id, async () => {
            return getVITEAddressOrCreateOne(message.user.id, "Twitter")
        })
        if(!await isAddressOkayPrivate(address, message))return

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = isRawTokenId ? currencyOrRecipient : tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const amount = new BigNumber(amountRaw === "all" ? balance : convert(amountRaw, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(amount) || balance.isEqualTo(0)){
                await twitc.v1.sendDm({
                    recipient_id: message.user.id,
                    text: `You don't have enough money to cover this withdraw. You need ${convert(amount, "RAW", currencyOrRecipient)} ${currencyOrRecipient} but you only have ${convert(balance, "RAW", currencyOrRecipient)} ${currencyOrRecipient} in your balance.`
                })
                return
            }
            const tx = await requestWallet(
                "send",
                address.address, 
                addr, 
                amount.toFixed(), 
                token
            )
            await twitc.v1.sendDm({
                recipient_id: message.user.id,
                text: `Your withdraw was processed!

View transaction on vitescan: https://vitescan.io/tx/${tx.hash}`
            })
        })
    }
}