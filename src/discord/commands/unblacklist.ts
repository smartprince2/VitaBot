import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import discordqueue from "../discordqueue";
import { parseDiscordUser } from "../util";

export default new class UnBlacklistCommand implements Command {
    description = "you shouldn't see this"
    extended_description = `You shouldn't see this.`
    alias = ["unblacklist"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[]){
        if(!message.guild)return
        if(!VITC_ADMINS.includes(message.author.id))return
        
        const id = args[0]
        const user = id && (await parseDiscordUser(id))[0]
        if(!user){
            await message.reply("Please add the id of an user.")
            return
        }
        const address = await discordqueue.queueAction(id, () => getVITEAddressOrCreateOne(user.id, "Discord"))
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