import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import Giveaway from "../../models/Giveaway";
import GiveawayEntry from "../../models/GiveawayEntry";
import Command from "../command";
import discordqueue from "../discordqueue";
import BigNumber from "bignumber.js"
import Tip from "../../models/Tip";
import { refreshBotEmbed } from "../GiveawayManager";
import { requestWallet } from "../../libwallet/http";
import { findDiscordRainRoles } from "../util";

export default new class TicketCommand implements Command {
    description = "Enter the current running giveaway in the channel"
    extended_description = `Enter the current giveaway in the channel. 
If there is a fee, it will be deducted from your account.

**Enter the current giveaway in the channel**
${process.env.DISCORD_PREFIX}ticket`
    alias = ["ticket", "enter", "e"]
    usage = ""

    async execute(message:Message){
        if(!message.guildId){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        try{
            await message.react("💊")
        }catch{}
        const roles = await findDiscordRainRoles(message.guildId)
        if(roles.length > 0){
            let hasRole = false
            for(const roleId of roles){
                if(message.member.roles.cache.has(roleId)){
                    hasRole = true
                    break
                }
            }
            if(!hasRole){
                try{
                    await message.delete()
                    await message.author.send(`You don't have the citizen role. You can't participate to this giveaway.`)
                }catch{}
                return
            }
        }
        const giveaway = await Giveaway.findOne({
            guild_id: message.guildId
        })
        if(!giveaway){
            try{
                await message.delete()
                await message.author.send(`No giveaways were found.`)
            }catch{}
            return
        }

        if(giveaway.fee > 0){
            // send money to the centralized giveaway account
            const [
                address,
                giveawayLockAccount
            ] = await Promise.all([
                discordqueue.queueAction(message.author.id, async () => {
                    return getVITEAddressOrCreateOne(message.author.id, "Discord")
                }),
                discordqueue.queueAction(giveaway.user_id, async () => {
                    return getVITEAddressOrCreateOne(giveaway.message_id, "Discord.Giveaway")
                })
            ])

            await viteQueue.queueAction(address.address, async () => {
                const entry = await GiveawayEntry.findOne({
                    user_id: message.author.id,
                    message_id: giveaway.message_id
                })
                if(entry){
                    try{
                        await message.delete()
                        await message.author.send(`You are already registered in that giveaway. Use \`${process.env.DISCORD_PREFIX}ticketstatus\` to see the status of your entry.`)
                    }catch{}
                    return
                }
                const feeRaw = convert(giveaway.fee, "VITC", "RAW")
                const balances = await requestWallet("get_balances", address.address)
                const balance = new BigNumber(balances[tokenIds.VITC] || 0)
                if(balance.isLessThan(feeRaw)){
                    try{
                        await message.delete()
                        await message.author.send(
                            `You need ${giveaway.fee} VITC to enter this giveaway but you only have ${convert(balance, "RAW", "VITC")} VITC in your balance. Use .deposit to top up your account.`
                        )
                    }catch{}
                    return
                }
                const tx = await requestWallet(
                    "send",
                    address.address,
                    giveawayLockAccount.address,
                    feeRaw,
                    tokenIds.VITC
                )
                await Promise.all([
                    GiveawayEntry.create({
                        user_id: message.author.id,
                        message_id: giveaway.message_id,
                        date: new Date(),
                        txhash: tx.hash
                    }),
                    Tip.create({
                        amount: giveaway.fee,
                        user_id: message.author.id,
                        date: new Date(),
                        txhash: tx.hash
                    })
                ])
                try{
                    await message.delete()
                    await message.author.send(`Your entry for the giveaway in **${message.guild.name}** has been confirmed! **${giveaway.fee} ${tokenNameToDisplayName("VITC")}** have been taken from your account as a giveaway entry fee.`)
                }catch{}
            })
        }else{
            await GiveawayEntry.create({
                user_id: message.author.id,
                message_id: giveaway.message_id
            })
            try{
                await message.delete()
                await message.author.send(`Your entry for the giveaway in **${message.guild.name}** has been confirmed!`)
            }catch{}
        }
        await refreshBotEmbed(giveaway)
    }
}