import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { parseDiscordUser } from "../util";

export default new class BlacklistCommand implements Command {
    description = "You shouldn't see this."
    extended_description = `You shouldn't see this.`
    alias = ["blacklist"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[]){
        if(!message.guild)return
        if(!message.member.roles.cache.has("862755971000172579") && !message.member.roles.cache.has("871009109237960704"))return
        
        const id = args[0]
        const user = id && (await parseDiscordUser(id))[0]
        if(!user){
            await message.reply("Please add the id of an user.")
            return
        }
        const address = await discordqueue.queueAction(user.id, () => getVITEAddressOrCreateOne(user.id, "Discord"))
        await message.channel.send(`Blacklisting User: ${user.tag} Address: ${address.address}`)
        if(address.paused){
            await message.channel.send("That user is already blacklisted.")
            return
        }
        address.paused = true
        await address.save()
        await message.channel.send(`Blacklisted successfuly`)
    }
}