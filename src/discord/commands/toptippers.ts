import { Message } from "discord.js";
import { client } from "..";
import Tip from "../../models/Tip";
import Command from "../command";
import { generateDefaultEmbed, parseDiscordUser } from "../util";

export default new class Toptippers implements Command {
    admins: string[] = [
        // 1appleaday
        "862414189464256542",
        // Kript
        "112006418676113408",

        // 5am
        "871221803580813373",
        // 6am
        "769939235616325632",
        // Jellyben
        "828802422364831825",
        // Not Thomiz
        "696481194443014174",
        // LUCA
        "659508168304492565",
        // mmmmm
        "400552599499177986",
        // imalfect
        "852640730093453372",

        // ispan
        "698806044087943179",
        // Rolex
        "397215033882443799",
        // shuttlecock
        "861182006502359080",
        // VitaMachine
        "553060199510966293",
        // WhiteFlag
        "533663361770979369",
        // YaroslavaWise
        "398394098127732738"
    ]

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
        .filter(e => !this.admins.includes(e._id))
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