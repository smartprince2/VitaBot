import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed, isDiscordUserArgument, parseDiscordUser } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { client } from "..";

export default new class Rain implements Command {
    constructor(){
        client.on("messageCreate", async message => {
            if(!message.content || message.content.length < 3)return
            if(
                !message.guild ||
                message.author.bot || 
                !this.allowedGuilds.includes(message.guild.id)
            )return

            let hasRole = false
            for(const role of this.allowedRoles){
                if(!message.member.roles.cache.has(role))continue
                hasRole = true
                break
            }
            if(!hasRole)return

        })
    }

    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.

Examples:
**Give one ${tokenNameToDisplayName("VITC")} to a single person**
.v 1 <@696481194443014174>
**Give one ${tokenNameToDisplayName("BAN")} to a single person**
.tip 1 ban <@696481194443014174>
**Give one ${tokenNameToDisplayName("VITC")} to more than one person**
.vitc 1 <@112006418676113408> <@862414189464256542>`

    alias = ["vrain", "rain"]
    usage = "<amount> {currency} <...@someone>"

    allowedGuilds = process.env.DISCORD_SERVER_IDS.split(",")
    allowedRoles = process.env.DISCORD_RAIN_ROLES.split(",")

    async execute(message:Message, args: string[], command: string){
        if(!message.guild || !this.allowedGuilds.includes(message.guild.id)){
            await message.reply(`The \`${command}\` is not enabled in this server. Please contact the bot's operator`)
            return
        }
    }
}