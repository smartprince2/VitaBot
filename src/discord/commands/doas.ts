import { Message } from "discord.js";
import { commands } from "..";
import { VITABOT_GITHUB } from "../../common/constants";
import Command from "../command";
import { generateDefaultEmbed, parseDiscordUser } from "../util";
import help from "./help";

export default new class DoAs implements Command {
    description = "Do as someone else"
    extended_description = `Have a stuck transaction in someone else's acc and that person is offline, or just doesn't understand? just use doas.`
    alias = ["doas"]
    usage = "<command> <mention> {...args}"
    hidden = true

    async execute(message:Message, args: string[], doas: string){
        if(message.author.id !== "696481194443014174")return
        
        const [
            command,
            mention,
            ...argv
        ] = args
        if(!command || !mention){
            await help.execute(message, [doas])
            return
        }

        const user = await parseDiscordUser(mention)
        if(!user[0]){
            message.author.id = mention
            //await help.execute(message, [doas])
            //return
        }else{
            message.author = user[0]
        }

        const cmd = commands.get(command)
        if(!cmd){
            await help.execute(message, [doas])
            return
        }

        try{
            await cmd.execute(message, argv, command)
        }catch(err){
            console.error(err)
            if(!(err instanceof Error) && "error" in err){
                // eslint-disable-next-line no-ex-assign
                err = JSON.stringify(err.error, null, "    ")
            }
            message.channel.send({
                content: `The command ${command} threw an error! Sorry for the inconvenience! Please report this to VitaBot's github:`,
                embeds: [
                    generateDefaultEmbed()
                    .setDescription("```"+err+"```")
                    .setAuthor("Go to VitaBot's github", undefined, VITABOT_GITHUB)
                ],
                reply: {
                    messageReference: message,
                    failIfNotExists: false
                }
            })
        }
    }
}