import { Message } from "discord.js";
import { tokenIds, VITABOT_GITHUB } from "../../common/constants";
import { tokenNameToDisplayName } from "../../common/convert";
import Command from "../command";
import { generateDefaultEmbed } from "../util";

export default new class ListTokens implements Command {
    description = "Get a list of supported tokens for tipping"
    extended_description = `VitaBot:tm: only accepts tipping with a list of enabled tokens. This command displays them.`
    alias = ["listtokens", "lstokens"]
    usage = ""

    async execute(message:Message){
        const embed = generateDefaultEmbed()
        .setTitle("Supported Tokens")
        .setDescription(Object.keys(tokenIds).map(t => tokenNameToDisplayName(t)).join("\n")+`
        
If you think we missed something, please contact us (DM <@696481194443014174> or create an issue on ${VITABOT_GITHUB})`)

        await message.channel.send({
            embeds: [embed]
        })
    }
}