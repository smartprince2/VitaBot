import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE, viteEvents } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import rain from "./rain";
import * as lt from "long-timeout"
import { resolveDuration } from "../../common/util";
import { generateDefaultEmbed, throwFrozenAccountError } from "../util";
import Airdrop from "../../models/Airdrop";
import { endAirdrop, timeoutsAirdrop, watchingAirdropMap } from "../AirdropManager";

export default new class AirdropCommand implements Command {
    description = "Start a new Airdrop"
    extended_description = `Start a new Airdrop!

Examples:
**Start an airdrop of 100 ${tokenNameToDisplayName("VITC")} for 10 winners!**
.airdrop 100 10
**Make the airdrop lasts one day**
.airdrop 10 1 1d`

    alias = ["airdrop"]
    usage = "<amount> <winners> <duration>"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(message.author.id !== "696481194443014174"){
            await message.channel.send("That command is limited to Thomiz. Please don't use it.")
            return
        }
        if(!message.guildId || !rain.allowedGuilds.includes(message.guildId)){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            // eslint-disable-next-line prefer-const
            winnersOrDurationRaw,
            durationRaw
        ] = args
        if(!durationRaw){
            durationRaw = "10m"
        }
        if(!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw)){
            await help.execute(message, [command])
            return
        }
        if(!winnersOrDurationRaw || !/^\d+$/.test(winnersOrDurationRaw) || winnersOrDurationRaw.length > 3){
            await help.execute(message, [command])
            return
        }
        const currency = "VITC"
        const maxDurationStr = message.member.permissions.has("MANAGE_CHANNELS") ? 
            "2w" : "1d"
        const maxDuration = resolveDuration(maxDurationStr)
        const [
            amount,
            tokenId,
            winners,
            duration
        ] = [
            new BigNumber(amountRaw),
            tokenIds[currency],
            parseInt(winnersOrDurationRaw),
            resolveDuration(durationRaw)
        ]
        try{
            await message.react("💊")
        }catch{}
        if(amount.div(winners).isLessThan(10)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `You can't start an airdrop for less than ${winners*10} VITC.`
            )
            return
        }
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
            message.author.send(`The maximum duration you are allowed to for a giveaway is **${maxDurationStr}**. You need the *MANAGE_CHANNELS* permission to make an airdrop last longer.`)
            return
        }
        const botMessage = await message.channel.send("Creating airdrop... Creating addresses and waiting for queue...")
        const [
            address,
            airdropLockAddress
        ] = await discordqueue.queueAction(message.author.id, async () => {
            return Promise.all([
                getVITEAddressOrCreateOne(message.author.id, "Discord"),
                getVITEAddressOrCreateOne(message.author.id, "Discord.Airdrop"),
            ])
        })

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await botMessage.edit("Creating airdrop... Locking funds...")
            }catch{}
            const balances = await getBalances(address.address)
            const balance = new BigNumber(balances[tokenId] || "0")
            const totalAmountRaw = new BigNumber(convert(totalAmount, currency, "RAW").split(".")[0])
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
            const hash = await sendVITE(
                address.seed, 
                airdropLockAddress.address, 
                totalAmountRaw.toFixed(), 
                tokenId
            )
            await new Promise(r => {
                viteEvents.once("receive_"+hash, r)
            })
            // Funds are SAFU, create an entry in the database
            const airdrop = await Airdrop.create({
                date: Date.now()+Number(duration),
                message_id: botMessage.id,
                channel_id: message.channelId,
                guild_id: message.guildId,
                winners: winners,
                amount: totalAmountRaw.toFixed(),
                user_id: message.author.id,
            })
            const embed = generateDefaultEmbed()
            .setAuthor(message.author.tag, message.author.displayAvatarURL({
                dynamic: true
            }))
            .setTitle(`Airdrop of ${amount.toFixed()} ${currency}!`)
            .setDescription(`React with 💊 to enter!
Ends at <t:${Math.floor(airdrop.date.getTime()/1000)}>
Max Winners: ${winners}
Amount: ${totalAmount.toFixed()} ${currency}`)
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