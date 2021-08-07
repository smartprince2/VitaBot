import { Message } from "discord.js";
import { commands, rawCommands } from "..";
import { BOT_VERSION } from "../../common/constants";
import Command from "../command";
import { generateDefaultEmbed } from "../util";

export default new class Help implements Command {
    description = "💊"
    extended_description = `This is the **help** command. You'll find a lot of informations on the other commands of the bot.
    
**<argument>** are **mandatory** arguments
**{argument}** are **optionnal** arguments

Examples: 
${process.env.DISCORD_PREFIX}help 2
${process.env.DISCORD_PREFIX}help deposit`
    alias = ["help"]
    usage = "{command or page}"

    async execute(message:Message, args:string[]){
        const embed = generateDefaultEmbed()
        .setAuthor(`VitaBot v${BOT_VERSION}`)
        let page = 1
        let command = null
        if(args.length === 1){
            if(/^\d+$/.test(args[0])){
                page = parseInt(args[0])
                if(page === 0){
                    command = "help"
                }
            }else{
                let cmd = args[0].toLowerCase()
                if(commands.has(cmd)){
                    command = cmd
                }else{
                    // invalid second argument
                    command = "help"
                }
            }
        }else if(args.length > 1){
            command = "help"
        }
        if(!command){
            const pagination = 25
            let totalPages = rawCommands.length/pagination
            if(Math.floor(totalPages) !== totalPages){
                totalPages = Math.floor(totalPages)+1
            }
            if(page > totalPages){
                embed.setTitle("Invalid Page")
                .setDescription(`You asked for page ${page}/${totalPages}, which is out of range.`)
                await message.channel.send({
                    embeds: [embed]
                })
                return
            }
            const startIndex = (page-1)*pagination
            const commands = rawCommands.slice(startIndex, pagination)
            embed.setTitle("Command Overview")
            .setDescription(`Use \`.help ${this.usage}\` to get more informations about a specific command or to change the page. 
You are currently at the ${page}/${totalPages} page.`)
            for(let command of commands){
                embed.addField(`${process.env.DISCORD_PREFIX}${command.alias[0]} ${command.usage}`, command.description)
            }
        }else{
            const cmd = commands.get(command)
            let description = cmd.extended_description
            description = `**Usage**:\n${process.env.DISCORD_PREFIX}${command} ${cmd.usage}\n\n${description}`
            if(cmd.alias[0] !== command){
                description = `*Alias of the ${cmd.alias[0]} command*\n\n${description}`
            }
            embed.setTitle(`Command Overview`)
            .setDescription(description)
        }
        await message.channel.send({
            embeds: [embed]
        })
    }
}