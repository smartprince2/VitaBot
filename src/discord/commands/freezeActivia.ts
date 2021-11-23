import { Message } from "discord.js";
import ActiveStats from "../../models/ActiveStats";
import ActiveStatus from "../../models/ActiveStatus";
import ActiviaFreeze from "../../models/ActiviaFreeze";
import activeQueue from "../activeQueue";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed, parseDiscordUser } from "../util";

export default new class FreezeActiviaCommand implements Command {
    description = "you shouldn't see this"
    extended_description = `You shouldn't see this.`
    alias = ["freezeactivia", "unfreezeactivia", "lsfreeze"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(!message.guild)return
        if(!VITC_ADMINS.includes(message.author.id))return
        
        if(command === "lsfreeze"){
            const freezes = await ActiviaFreeze.find()
            const embed = generateDefaultEmbed()
            .setTitle("Activia Freeze")
            .setDescription((await Promise.all(freezes.map(async (freeze) => {
                const user = await parseDiscordUser(freeze.user_id)
                return `<@${freeze.user_id}> (${user[0].tag})`
            }))).join("\n") || "No one is frozen.")
            await message.channel.send({
                embeds: [embed]
            })
        }else{
            const id = args[0]
            const user = id && (await parseDiscordUser(id))[0]
            if(!user){
                await message.reply("Please add the id of an user.")
                return
            }
            await message.channel.send(`${command.replace("freezeactivia", "")}freezing <@${user.id}> (${user.tag})`)
            await activeQueue.queueAction(user.id, async () => {
                const activiafreeze = await ActiviaFreeze.findOne({
                    user_id: user.id
                })
                if(activiafreeze){
                    switch(command){
                        case "freezeactivia": {
                            await message.reply("This user's activia is already frozen.")
                            return
                        }
                        case "unfreezeactivia": {
                            await activiafreeze.delete()
                            await message.react("909408282307866654")
                            return
                        }
                    }
                }else{
                    switch(command){
                        case "freezeactivia": {
                            await Promise.all([
                                ActiviaFreeze.create({
                                    user_id: user.id
                                }),
                                ActiveStats.deleteMany({
                                    user_id: user.id
                                }),
                                ActiveStatus.deleteMany({
                                    user_id: user.id
                                })
                            ])
                            await message.react("909408282307866654")
                            return
                        }
                        case "unfreezeactivia": {
                            await message.reply("This user's activia is not frozen.")
                            return
                        }
                    }
                }
            })
        }
    }
}