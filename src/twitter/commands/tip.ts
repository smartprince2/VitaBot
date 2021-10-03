import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { BulkSendResponse, requestWallet } from "../../libwallet/http";
import { createDM, DMMessage, mention, replyTweet } from "..";
import { extractMention, isAddressOkayPrivate, isAddressOkayPublic } from "../util";
import { fetchUserByUsername } from "../users";
import { TweetV1, UserV2 } from "twitter-api-v2";
import twitterqueue from "../twitterqueue";

export default new class TipCommand implements Command {
    description = "Tip someone on Twitter"
    extended_description = `Tip someone on Twitter. 
If they don't have an account on the tipbot, it will create one for them.

Examples:
Give one ${tokenNameToDisplayName("VITC")} to a single person
    ${mention} v 1 @NotThomiz
Give one ${tokenNameToDisplayName("BAN")} to a single person
    ${mention} tip 1 ban @NotThomiz
Give one ${tokenNameToDisplayName("VITC")} to more than one person
    ${mention} vitc 1 @NotThomiz @jen_wina`

    alias = ["tip", "vitc", "v"]
    usage = "<amount> {currency} <...@someone>"

    public = true
    dm = true

    async executePublic(tweet:TweetV1, args: string[], command: string){
        const tip = await this.sendTip(args, command, tweet.user.id_str, "public", tweet)
        if(!tip)return
        if(tip.type == "help")return help.executePublic(tweet, [command])
        const text = this.getText(tip)
        await replyTweet(tweet.id_str, text)
    }

    async executePrivate(message:DMMessage, args:string[], command: string){
        const tip = await this.sendTip(args, command, message.user.id, "private", message)
        console.log(tip)
        if(!tip)return
        if(tip.type == "help")return help.executePrivate(message, [command])
        const text = this.getText(tip)
        await createDM(message.user.id, text)
    }

    getText(tip){
        switch(tip.type){
            case "currency_not_vitc": {
                return `Looks like you tried to use another currency than vitc. Please use the .tip command for this.`
            }
            case "unsupported_currency": {
                return `The token ${tip.currency} isn't supported.`
            }
            case "tip_zero": {
                return `You can't send a tip of 0 ${tokenNameToDisplayName(tip.currency)}.`
            }
            case "insufficient_balance": {
                return `You don't have enough money to cover this tip. You need ${
                    tip.asked
                } ${tokenNameToDisplayName(tip.currency)} but you only have ${tip.balance} ${
                    tokenNameToDisplayName(tip.currency)
                } in your balance. Use .deposit to top up your account.`
            }
            case "tipped": {
                if(tip.recipients.length > 1){
                    return `You have sent ${tip.amount} ${tokenNameToDisplayName(tip.currency)} to ${tip.recipients.length} people each!
                    
https://vitescan.io/tx/${tip.txs[0][0].hash}`
                }else{
                    return `You tipped ${tip.amount} ${tokenNameToDisplayName(tip.currency)} to ${tip.recipients[0].username}!

https://vitescan.io/tx/${tip.txs[0][0].hash}`
                }
            }
        }
    }

    async sendTip(args:string[], command:string, user_id:string, type: "public", tweet: TweetV1)
    async sendTip(args:string[], command:string, user_id:string, type: "private", message: DMMessage)
    async sendTip(args:string[], command:string, user_id:string, type: "public"|"private", tm: TweetV1|DMMessage){
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient,
            // eslint-disable-next-line prefer-const
            ...recipientsRaw
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vitc"
        if(!amount || !/^\d+(\.\d+)?$/.test(amount))return {
            type: "help"
        }
        const currencyMention = extractMention([currencyOrRecipient])
        if(currencyMention.length > 0){
            // user here
            recipientsRaw.push(currencyOrRecipient)
            currencyOrRecipient = "vitc"
        }
        if(recipientsRaw.length === 0 && type === "public"){
            // tip the author of the tweet above us.
            const tweet = tm as TweetV1
            if(tweet.in_reply_to_user_id_str){
                // autofill the user's name
                recipientsRaw.unshift(`@${tweet.in_reply_to_screen_name}`)
            }
        }
        currencyOrRecipient = currencyOrRecipient.toUpperCase()
        if(command !== "tip" && currencyOrRecipient !== "VITC"){
            return {
                type: "currency_not_vitc"
            }
        }

        if(!(currencyOrRecipient in tokenIds))return {
            type: "unsupported_currency",
            currency: currencyOrRecipient
        }
        if(recipientsRaw.length === 0)return {
            type: "help"
        }

        const amountParsed = new BigNumber(amount)
        if(amountParsed.isEqualTo(0)){
            return {
                type: "tip_zero"
            }
        }

        const recipients:UserV2[] = []
        const promises = []
        for(const mention of extractMention(recipientsRaw)){
            promises.push((async () => {
                try{
                    const user = await fetchUserByUsername(mention)
                    if(!user)return
                    if(user.id === user_id)return
                    if(recipients.find(e => e.id === user.id))return
                    recipients.push(user)
                }catch{}
            })())
        }
        await Promise.all(promises)
        if(recipients.length === 0){
            const tweet = tm as TweetV1
            let shouldHelp = true
            if(type === "public" && tweet.in_reply_to_screen_name){
                const user = await fetchUserByUsername(tweet.in_reply_to_screen_name)
                if(user && user.id !== user_id){
                    recipients.push(user)
                    shouldHelp = false
                }
            }
            if(shouldHelp)return {
                type: "help"
            }
        }
        const totalAsked = amountParsed.times(recipients.length)

        const [
            address,
            addresses
        ] = await Promise.all([
            twitterqueue.queueAction(user_id, async () => {
                return getVITEAddressOrCreateOne(user_id, "Twitter")
            }),
            Promise.all(recipients.map(async (recipient) => {
                return twitterqueue.queueAction(recipient.id, async () => {
                    return getVITEAddressOrCreateOne(recipient.id, "Twitter")
                })
            }))
        ])

        switch(type){
            case "private":
                if(!await isAddressOkayPrivate(address, tm as DMMessage))return
            break
            case "public":
                if(!await isAddressOkayPublic(address, tm as TweetV1))return
        }

        return viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const totalAskedRaw = new BigNumber(convert(totalAsked, currencyOrRecipient, "RAW").split(".")[0])
            if(balance.isLessThan(totalAskedRaw)){
                return {
                    type: "insufficient_balance",
                    asked: totalAsked.toFixed(),
                    currency: currencyOrRecipient,
                    balance: convert(balance, "RAW", currencyOrRecipient)
                }
            }
            if(addresses.length > 1){
                const amount = convert(amountParsed, currencyOrRecipient, "RAW").split(".")[0]
                const txs:BulkSendResponse = await requestWallet(
                    "bulk_send",
                    address.address, 
                    addresses.map(e => [
                        e.address,
                        amount
                    ]), 
                    token
                )
                return {
                    type: "tipped",
                    txs: txs,
                    amount: convert(amount, "RAW", currencyOrRecipient),
                    currency: currencyOrRecipient,
                    recipients: recipients
                }
            }else{
                const amount = convert(amountParsed, currencyOrRecipient, "RAW").split(".")[0]
                const tx = await requestWallet(
                    "send",
                    address.address, 
                    addresses[0].address, 
                    amount, 
                    token
                )
                return {
                    type: "tipped",
                    txs: [[tx],[]],
                    amount: convert(amount, "RAW", currencyOrRecipient),
                    currency: currencyOrRecipient,
                    recipients: recipients
                }
            }
        })
    }
}