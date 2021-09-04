import { Message } from "discord.js";
import GiveawayWinner from "../../models/GiveawayWinner";
import Tip from "../../models/Tip";
import Command from "../command";
import { generateDefaultEmbed } from "../util";

export default new class WinnersCommand implements Command {
    description = "Show previous giveaway winners"
    extended_description = `Show previous giveaway winners.

Examples:
**See statistics**
.winners`

    alias = ["winners"]
    usage = ""

    async execute(message:Message){
        const [
            numOfWinners,
            last15,
            numOfWonGiveaways
        ] = await Promise.all([
            GiveawayWinner.countDocuments(),
            GiveawayWinner.find().sort({date: -1}).limit(15),
            GiveawayWinner.countDocuments({
                user_id: message.author.id
            })
        ])
        
        const embed = generateDefaultEmbed()
        .setTitle("Giveaway Statistics")
        .setDescription(`💊Recent Giveaways Winner💊
${last15.map((gw, i) => {
    return `${i+1}. <@${gw.user_id}> <t:${Math.floor(gw.date.getTime()/1000)}:R> [[Link]](https://discord.com/channels/${gw.guild_id}/${gw.channel_id}/${gw.announce_id})`
})}

💊Your giveaway statistics💊
You have won **${numOfWonGiveaways} giveaways** on a total of **${numOfWinners} giveaways**.`)
        await message.channel.send({
            embeds: [embed]
        })
    }
}