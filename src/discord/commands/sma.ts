import { Message, User } from "discord.js";
import Command from "../command";
import { BOT_OWNER } from "../constants";
import { ID_PATTERN, USER_PATTERN } from "../util";
import * as vite from "vitejs-notthomiz"
import { client } from "..";
import discordqueue from "../discordqueue";
import PersonalAddress from "../../models/PersonalAddress";

export default new class SMACommand implements Command {
    description = "you shouldn't see this"
    extended_description = `Add a mod's address into the distribution system.`
    alias = ["sma"]
    usage = "<mod> <address>"
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
        let addr = null
        if(!args[1] || !vite.wallet.isValidAddress(args[1]) && args[1] !== "none"){
            await message.reply("Invalid Wallet Address.")
            return
        }

        if(args[1] !== "none"){
            addr = args[1]
        }

        await discordqueue.queueAction(user.id, async () => {
            const address = await PersonalAddress.findOne({
                id: user.id,
                platform: "Discord"
            })
            if(address && addr){
                await message.reply(`**${user.tag}** is already registered. ${address.address}`)
            }else if(address){
                await address.delete()
                await message.reply(`**${user.tag}** was removed from mod distribution.`)
            }else if(addr){
                const address = await PersonalAddress.create({
                    address: addr,
                    id: user.id,
                    platform: "Discord"
                })
                await message.reply(`**${user.tag}** was added to mod distribution. ${address.address}`)
            }else{
                await message.reply(`**${user.tag}** is not registered in distribution.`)
            }
        })

    }
}