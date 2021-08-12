import { Message } from "discord.js";
import Command from "../command";

export default new class Deposit implements Command {
    description = "Restart the bot"
    extended_description = "No need for a description"
    alias = ["restart"]
    usage = ""

    async execute(message:Message){
        if(![
            "112006418676113408",
            "871221803580813373",
            "696481194443014174"
        ].includes(message.author.id)){
            await message.reply("You don't have the permission.")
            return
        }

        await message.reply("Restarting...")
        process.exit()
    }
}