import { Message } from "discord.js";
import { allowedCoins, disabledTokens, tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address"
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import * as lt from "long-timeout"
import { resolveDuration } from "../../common/util";
import { throwFrozenAccountError } from "../util";
import Airdrop from "../../models/Airdrop";
import { endAirdrop, getAirdropEmbed, timeoutsAirdrop, watchingAirdropMap } from "../AirdropManager";
import { requestWallet } from "../../libwallet/http";
import Tip from "../../models/Tip";
import { parseAmount } from "../../common/amounts";

export default new class AirdropCommand implements Command {
    description = "Start a new Airdrop"
    extended_description = `Start a new Airdrop!

Examples:
**Start an airdrop of 100 ${tokenNameToDisplayName("VITC")} for 10 winners!**
.airdrop 100 10
**Make the airdrop lasts one day**
.airdrop 10 10 1d
**Airdrop 10 ${tokenNameToDisplayName("VITE")}**
.airdrop 10 vite 10 1d`

    alias = ["airdrop"]
    usage = "<amount> {currency} {winners} {duration}"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(!message.guildId){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            // eslint-disable-next-line prefer-const
            currency,
            // eslint-disable-next-line prefer-const
            winnersRaw,
            durationRaw
        ] = args
        if(!durationRaw){
            durationRaw = "10m"
        }
        if(!amountRaw){
            await help.execute(message, [command])
            return
        }
        if(!currency){
            await help.execute(message, [command])
            return
        }
        if(/^\d+$/.test(currency)){
            durationRaw = winnersRaw
            winnersRaw = currency
            currency = "VITC"
        }
        if(!winnersRaw){
            winnersRaw = "999"
        }
        if(!/^\d+$/.test(winnersRaw) || winnersRaw.length > 3){
            await help.execute(message, [command])
            return
        }
        currency = currency.toUpperCase()
        if(!(currency in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currency}** isn't supported.`)
            return
        }
        if((tokenIds[currency] in disabledTokens)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currency}** is currently disabled, because: ${disabledTokens[tokenIds[currency]]}`)
            return
        }
        if(!(allowedCoins[message.guildId] || [tokenIds[currency]]).includes(tokenIds[currency])){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `You can't use **${tokenNameToDisplayName(currency)}** (${currency}) in this server.`
            )
            return
        }
        const maxDurationStr = message.member
            .permissionsIn(message.channelId).has("MANAGE_CHANNELS") ? 
                "2w" : "1d"
        const minDurationStr = "5m"
        const maxDuration = resolveDuration(maxDurationStr)
        const minDuration = resolveDuration(minDurationStr)
        const [
            amount,
            tokenId,
            winners,
            duration
        ] = [
            parseAmount(amountRaw, tokenIds[currency]),
            tokenIds[currency],
            parseInt(winnersRaw),
            resolveDuration(durationRaw || "5m")
        ]
        try{
            await message.react("💊")
        }catch{}
        /*if(amount.div(winners).isLessThan(1)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `You can't start an airdrop for less than **1 ${tokenNameToDisplayName("VITC")}** per winner.`
            )
            return
        }*/
        if(winners === 0){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `You can't start a giveaway with 0 winners.`
            )
            return
        }
        const totalAmount = amount
        if(duration > maxDuration){
            try{
                await message.react("❌")
            }catch{}
            message.author.send(`The maximum duration you are allowed to for airdrop is **${maxDurationStr}**. You need the *MANAGE_CHANNELS* permission to make an airdrop last longer.`)
            return
        }
        if(duration < minDuration){
            try{
                await message.react("❌")
            }catch{}
            message.author.send(`The minimum duration you are allowed to for airdrop is **${minDurationStr}**.`)
            return
        }
        const botMessage = await message.channel.send("Loading... ⌛")
        const [
            address,
            airdropLockAddress
        ] = await discordqueue.queueAction(message.author.id, async () => {
            return Promise.all([
                getVITEAddressOrCreateOne(message.author.id, "Discord"),
                getVITEAddressOrCreateOne(botMessage.id, "Discord.Airdrop"),
            ])
        })

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const balance = new BigNumber(balances[tokenId] || "0")
            const totalAmountRaw = new BigNumber(convert(totalAmount, currency, "RAW"))
            if(balance.isLessThan(totalAmountRaw)){
                try{
                    await message.react("❌")
                }catch{}
                try{
                    await botMessage.delete()
                }catch{}
                await message.author.send(
                    `You don't have enough money to cover this airdrop. You need ${totalAmount.toFixed()} ${currency} but you only have ${convert(balance, "RAW", currency)} ${currency} in your balance. Use .deposit to top up your account.`
                )
                return
            }
            const [stx] = await requestWallet(
                "send_wait_receive",
                address.address, 
                airdropLockAddress.address, 
                totalAmountRaw.toFixed(), 
                tokenId
            )
            // Funds are SAFU, create an entry in the database
            const [
                airdrop
            ] = await Promise.all([
                Airdrop.create({
                    date: Date.now()+Number(duration),
                    message_id: botMessage.id,
                    channel_id: message.channelId,
                    guild_id: message.guildId,
                    winners: winners,
                    user_id: message.author.id,
                }),
                Tip.create({
                    amount: parseFloat(convert(totalAmountRaw, "RAW", currency)),
                    user_id: message.author.id,
                    date: new Date(),
                    txhash: stx.hash
                })
            ])
            try{
                await message.react("909408282307866654")
            }catch{}
            const embed = await getAirdropEmbed(airdrop)
            await botMessage.react("💊")
            await botMessage.edit({
                embeds: [embed],
                content: null
            })
            if(!watchingAirdropMap.has(airdrop.message_id)){
                watchingAirdropMap.set(airdrop.message_id, airdrop)
                if(!timeoutsAirdrop.has(airdrop.message_id)){
                    timeoutsAirdrop.set(airdrop.message_id, lt.setTimeout(() => {
                        // Airdrop should have ended!
                        endAirdrop(airdrop)
                    }, airdrop.date.getTime()-Date.now()))
                }
            }

        })
    }
}