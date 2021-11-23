import { Message } from "discord.js";
import { publicBot } from "..";
import Command from "../command";

export default new class InviteCommand implements Command {
    description = "Show the bot's invite"
    extended_description = `Show the bot's invite.`

    alias = ["invite"]
    usage = ""

    async execute(message:Message){
        await message.author.send(
            `Hey, thanks for showing interest in me, here's the bot invite: https://discord.com/oauth2/authorize?client_id=${publicBot}&permissions=515399609408&scope=bot`
        )
        if(message.guild){
            await message.reply("I've sent my invite in dms!")
        }
    }
}