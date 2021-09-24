import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { isDiscordUserArgument, parseDiscordUser, throwFrozenAccountError } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import Tip from "../../models/Tip";
import { BulkSendResponse, requestWallet } from "../../libwallet/http";

export default new class TipCommand implements Command {
    description = "Tip someone on Discord"
    extended_description = `Tip someone over Discord. 
If they don't have an account on the tipbot, it will create one for them.

Examples:
**Give one ${tokenNameToDisplayName("VITC")} to a single person**
.v 1 <@696481194443014174>
**Give one ${tokenNameToDisplayName("BAN")} to a single person**
.tip 1 ban <@696481194443014174>
**Give one ${tokenNameToDisplayName("VITC")} to more than one person**
.vitc 1 <@112006418676113408> <@862414189464256542>`

    alias = ["vitc", "v", "tip"]
    usage = "<amount> {currency} <...@someone>"

    async execute(message:Message, args: string[], command: string){
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient,
            // eslint-disable-next-line prefer-const
            ...recipientsRaw
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vitc"
        if(!amount || !/^\d+(\.\d+)?$/.test(amount))return help.execute(message, [command])
        if(isDiscordUserArgument(currencyOrRecipient)){
            // user here
            recipientsRaw.push(currencyOrRecipient)
            currencyOrRecipient = "vitc"
        }
        currencyOrRecipient = currencyOrRecipient.toUpperCase()
        if(command !== "tip" && currencyOrRecipient !== "VITC"){
            if(recipientsRaw.length > 0){
                currencyOrRecipient = "VITC"
            }else{
                message.reply(`Looks like you tried to use another currency than vitc. Please use the .tip command for this.`)
                return
            }
        }
        if(message.mentions.repliedUser){
            recipientsRaw.push(message.mentions.repliedUser.id)
        }

        if(!(currencyOrRecipient in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currencyOrRecipient}** isn't supported.`)
            return
        }
        if(recipientsRaw.length === 0)return help.execute(message, [command])

        const amountParsed = new BigNumber(amount)
        if(amountParsed.isEqualTo(0)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `You can't send a tip of **0 ${tokenNameToDisplayName(currencyOrRecipient)}**.`
            )
            return
        }

        const recipients = []
        const promises = []
        for(const recipient of recipientsRaw){
            promises.push((async () => {
                try{
                    const users = await parseDiscordUser(recipient)
                    for(const user of users){
                        // couldn't find it
                        if(!user)continue
                        // bot
                        if(user.bot)continue
                        // same person sending to itself
                        if(user.id === message.author.id)continue
                        // User already resolved, double pinging.
                        if(recipients.find(e => e.id === user.id))continue
                        recipients.push(user)
                    }
                }catch{}
            })())
        }
        await Promise.all(promises)
        if(recipients.length === 0){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const totalAsked = amountParsed.times(recipients.length)

        const [
            address,
            addresses
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            Promise.all(recipients.map(async (recipient) => {
                return discordqueue.queueAction(recipient.id, async () => {
                    return getVITEAddressOrCreateOne(recipient.id, "Discord")
                })
            }))
        ])

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react("💊")
            }catch{}
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const totalAskedRaw = new BigNumber(convert(totalAsked, currencyOrRecipient, "RAW").split(".")[0])
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `You don't have enough money to cover this tip. You need ${totalAsked.toFixed()} ${currencyOrRecipient} but you only have ${convert(balance, "RAW", currencyOrRecipient)} ${currencyOrRecipient} in your balance. Use .deposit to top up your account.`
                )
                return
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
                if(currencyOrRecipient === "VITC"){
                    const promises = []
                    for(const tx of txs[1]){
                        promises.push(Tip.create({
                            amount: parseFloat(
                                convert(
                                    amount, 
                                    "RAW", 
                                    "VITC"
                                )
                            ),
                            user_id: message.author.id,
                            date: new Date(),
                            txhash: tx.hash
                        }))
                    }
                    await Promise.all(promises)
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
                if(currencyOrRecipient === "VITC"){
                    await Tip.create({
                        amount: parseFloat(
                            convert(
                                amount, 
                                "RAW", 
                                "VITC"
                            )
                        ),
                        user_id: message.author.id,
                        date: new Date(),
                        txhash: tx.hash
                    })
                }
            }
            try{
                await message.react("873558842699571220")
            }catch{}
        })
    }
}