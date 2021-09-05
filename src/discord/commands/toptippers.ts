import { Message } from "discord.js";
import Tip from "../../models/Tip";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed, parseDiscordUser } from "../util";

export default new class Toptippers implements Command {
    description = "See the bot's top tippers"
    extended_description = `Display a list of the best tippers.

Examples:
**See top tippers**
.toptippers`

    alias = ["toptippers"]
    usage = ""

    async execute(message:Message){
        const topTippers = await Tip.aggregate([
            {
                $group: {
                    _id: "$user_id",
                    sum: {
                        $sum: "$amount"
                    }
                }
            }
        ])
        const topTipps = topTippers
        .filter(e => !VITC_ADMINS.includes(e._id))
        .sort((a, b) => b.sum-a.sum)
        .slice(0, 15)
        
        const tippers = await Promise.all(
            topTipps.map(async e => {
                return {
                    amount: e.sum,
                    user: (await parseDiscordUser(e._id))[0]
                }
            })
        )
        const embed = generateDefaultEmbed()
        .setTitle("Top 15 tippers")
        .setDescription(tippers.map((tipper, i) => {
            return `${i+1}. **${Math.floor(tipper.amount*100)/100} VITC** - By **${tipper.user?.tag}**`
        }).join("\n") || "Looks like the list is empty...")


        await message.reply({
            embeds: [embed]
        })
    }
}