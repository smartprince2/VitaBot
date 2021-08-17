import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import { parseDiscordUser } from "../util";

export default new class UnblacklistCommand implements Command {
    description = "fuck you"
    extended_description = `You shouldn't see this.`
    alias = ["unblacklist"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[]){
        if(!message.guild)return
        if(!message.member.roles.cache.has("862755971000172579") && !message.member.roles.cache.has("871009109237960704"))return
        
        const id = args[0]
        const user = id && await parseDiscordUser(id)
        if(!user){
            await message.reply("Please add the id of an user.")
            return
        }
        const address = await discordqueue.queueAction(id, () => getVITEAddressOrCreateOne(id, "Discord"))
        await message.channel.send(`Unblacklisting User: ${user.tag} Address: ${address.address}`)
        if(!address.paused){
            await message.channel.send("That user is not blacklisted.")
            return
        }
        address.paused = false
        await address.save()
        await message.channel.send(`Unblacklisted successfuly`)
    }
}