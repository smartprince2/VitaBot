import { Message, User } from "discord.js";
import Command from "../command";
import { BOT_OWNER } from "../constants";
import { ID_PATTERN, USER_PATTERN } from "../util";
import { client } from "..";
import discordqueue from "../discordqueue";
import PersonalAddress from "../../models/PersonalAddress";
import { tokenNameToDisplayName } from "../../common/convert";
import ModsBonus from "../../models/ModsBonus";

export default new class GiveBonusCommand implements Command {
    description = "you shouldn't see this"
    extended_description = `Give a bonus of 10k ${tokenNameToDisplayName("VITC")} to a mod.`
    alias = ["givebonus"]
    usage = "<mod> <reason>"
    hidden = true

    async execute(message:Message, args: string[]){
        if(!message.guild)return
        if(message.author.id !== BOT_OWNER && message.author.id !== "112006418676113408"){
            await message.reply(`That command is reserved to <@${BOT_OWNER}>.`)
            return
        }

        let user:User

        if(args[0]){
            if(ID_PATTERN.test(args[0])){
                // user id
                user = await client.users.fetch(args[0]).catch(()=>null)
            }else if(USER_PATTERN.test(args[0])){
                // user mention
                const parsed = args[0].match(USER_PATTERN)
                user = await client.users.fetch(parsed.groups.id).catch(()=>null)
            }
        }
        
        if(!user){
            await message.reply("Please mention an user.")
            return
        }
        
        const reason = args.slice(1).join(" ") || "No reason specified."

        await discordqueue.queueAction(user.id, async () => {
            const address = await PersonalAddress.findOne({
                id: user.id,
                platform: "Discord"
            })
            if(!address){
                await message.reply(`**${user.tag}** is not registered in distribution.`)
                return
            }
            await ModsBonus.create({
                id: user.id,
                platform: "Discord",
                reason: reason
            })
            await message.reply(`**${user.tag}** will receive a bonus of **10k ${tokenNameToDisplayName("VITC")}** next monday.`)
        })

    }
}