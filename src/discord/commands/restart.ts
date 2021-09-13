import { Message } from "discord.js";
import Command from "../command";
import { VITC_ADMINS } from "../constants";

export default new class RestartCommand implements Command {
    description = "Restart the bot"
    extended_description = "No need for a description"
    alias = ["restart"]
    usage = ""
    hidden = true

    async execute(message:Message){
        if(!VITC_ADMINS.includes(message.author.id)){
            await message.reply("You don't have the permission.")
            return
        }

        await message.reply("Restarting...")
        process.exit()
    }
}