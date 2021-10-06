import { Message } from "discord.js";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed, ID_PATTERN, USER_PATTERN } from "../util";
import help from "./help";
import * as vite from "vitejs-notthomiz"
import { client } from "..";
import { getVITEAddress, parseTransactionType } from "../../wallet/address";
import Address from "../../models/Address";
import discordqueue from "../discordqueue";

export default new class UwUCommand implements Command {
    description = "you shouldn't see this"
    extended_description = `You shouldn't see this.`
    alias = ["uwu"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(!message.guild)return
        if(!VITC_ADMINS.includes(message.author.id))return
        
        await message.react("💊").catch(()=>{})
        let rawAddress:string = null
        if(!args[0]){
            await message.react("❌").catch(()=>{})
            await help.execute(message, [command])
            return
        }
        if(vite.wallet.isValidAddress(args[0])){
            const address = await Address.findOne({
                address: args[0]
            })
            if(address){
                rawAddress = args[0]
            }
        }else if(ID_PATTERN.test(args[0])){
            // user id
            const user = await client.users.fetch(args[0]).catch(()=>{})
            if(user){
                const address = await discordqueue.queueAction(user.id, () => {
                    return getVITEAddress(user.id, "Discord").catch(()=>{})
                })
                if(address){
                    rawAddress = address.address
                }
            }
        }else if(USER_PATTERN.test(args[0])){
            // user mention
            const parsed = args[0].match(USER_PATTERN)
            const user = await client.users.fetch(parsed.groups.id).catch(()=>{})
            if(user){
                const address = await discordqueue.queueAction(user.id, () => {
                    return getVITEAddress(user.id, "Discord").catch(()=>{})
                })
                if(address){
                    rawAddress = address.address
                }
            }
        }
        if(!rawAddress){
            await message.react("❌").catch(()=>{})
            await message.reply(`Either that address is invalid, either that address isn't from the tipbot, either that user is invalid, either that user doesn't have an address registered at the tipbot.`)
            return
        }

        const address = await Address.findOne({
            address: rawAddress
        })

        const meaning = []
        for(const handle of address.handles){
            const parsed = await parseTransactionType(handle, null)
            switch(parsed.type){
                case "giveaway":{
                    meaning.push("Discord Giveaway")
                    break
                }
                case "faucet":{
                    meaning.push("Discord Prescription Channel")
                    break
                }
                case "tip":{
                    switch(parsed.platform){
                        case "Discord": {
                            const user = await client.users.fetch(parsed.id).catch(()=>null)
                            meaning.push(user?.tag || "Unknown user")
                            break
                        }
                        default: {
                            meaning.push(`${parsed.id}:${parsed.platform}`)
                        }
                    }
                    break
                }
                case "rewards": {
                    meaning.push("SBP Distribution Address")
                    break
                }
                case "unknown": {
                    meaning.push("Bot Quota Accelerator")
                    break
                }
                case "Unknown": {
                    meaning.push("wtf is this")
                }
            }
        }

        const embed = generateDefaultEmbed()
        .setDescription(`**Address**
\`\`\`${address.address}\`\`\`
**Address Handles**
\`\`\`${address.handles.join("\n")}\`\`\`
**Address Handles Meaning**
\`\`\`${meaning.join("\n")}\`\`\`
[Link to vitescan](https://vitescan.io/address/${address.address})`)

        await message.reply({
            embeds: [embed],
            content: address.address
        })

        await message.react("873558842699571220").catch(()=>{})
    }
}