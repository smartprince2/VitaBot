import { Message } from "discord.js";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed, parseDiscordUser } from "../util";
import PersonalAddress from "../../models/PersonalAddress";
import ModsBonus from "../../models/ModsBonus";
import { tokenNameToDisplayName } from "../../common/convert";

export default new class GiveBonusCommand implements Command {
    description = "you shouldn't see this"
    extended_description = `See the list of bonuses for each mod.`
    alias = ["bonuses"]
    usage = ""
    hidden = true

    async execute(message:Message){
        if(!message.guild)return
        if(!VITC_ADMINS.includes(message.author.id))return

        const users = await PersonalAddress.find({
            platform: "Discord"
        })
        let bonusCount = 0
        const embed = generateDefaultEmbed()

        await Promise.all(users.map(async address => {
            const [
                bonuses,
                [user]
            ] = await Promise.all([
                ModsBonus.find({
                    id: address.id,
                    platform: address.platform
                }),
                parseDiscordUser(address.id)
            ])
            bonusCount += bonuses.length
            if(bonuses.length > 0){
                embed.addField(user.tag, bonuses.map(b => b.reason).join("\n"), true)
            }
        }))

        embed.setDescription(`Eligible users: **${users.length} users**
Users with bonuses: **${embed.fields.length} users**
Bonuses count: **${bonusCount} bonuses**
Total Distribution Amount: **${30000*users.length+bonusCount*10000} ${tokenNameToDisplayName("VITC")}**`)

        await message.reply({
            embeds: [embed]
        })
    }
}