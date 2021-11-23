import { Message } from "discord.js";
import Giveaway from "../../models/Giveaway";
import Command from "../command";
import { endGiveaway, resolveGiveaway, timeoutsGiveway } from "../GiveawayManager";
import * as lt from "long-timeout"

export default new class GiveawayEndCommand implements Command {
    description = "End the current giveaway"
    extended_description = `End the current giveaway.
Will end, and chose a winner for the current running giveaway.

**End the current giveaway**
${process.env.DISCORD_PREFIX}gend`
    alias = ["gend", "giveawayend"]
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
        if(!message.member.permissions.has("MANAGE_MESSAGES")){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`You don't have the permission to end the current giveaway.`)
            return
        }
        const giveaway = await Giveaway.findOne({
            guild_id: message.guildId
        })
        if(!giveaway){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`No giveaways were found.`)
            return
        }

        const timeout = timeoutsGiveway.get(giveaway.message_id)

        lt.clearTimeout(timeout)
        await endGiveaway(giveaway)
        const resolve = resolveGiveaway.get(giveaway.message_id)
        resolve()
        try{
            await message.react("909408282307866654")
        }catch{}
    }
}