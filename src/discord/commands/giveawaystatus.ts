import { Message } from "discord.js";
import Giveaway from "../../models/Giveaway";
import Command from "../command";
import { refreshBotEmbed } from "../GiveawayManager";

export default new class GiveawayStatusCommand implements Command {
    description = "See the status of the current giveaway"
    extended_description = `See the status of the current giveaway.
It will also refresh the old embed on the original message.

**See the status of the current running giveaway**
${process.env.DISCORD_PREFIX}gs`
    alias = ["giveawaystatus", "gs"]
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

        const embed = await refreshBotEmbed(giveaway)
        await message.channel.send({
            embeds: [embed]
        })
        try{
            await message.react("909408282307866654")
        }catch{}
    }
}