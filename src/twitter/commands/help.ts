import { commands, createDM, DMMessage, rawCommands, replyTweet, Tweet } from "..";
import Command from "../command";

export default new class HelpCommand implements Command {
    public = true
    dm = true
    description = "See the help menu"
    extended_description = `This is the help command. You'll find a lot of informations on other commands of the bot.

<argument> are mandatory arguments
{argument} are optionnal arguments

Example:
    .help
    .help deposit`
    alias = ["help"]
    usage = ""

    async executePublic(data:Tweet, args: string[]){
        await this.sendHelp(data.user.id, args[0])
        await replyTweet(data.in_reply_to_status_id, "I've sent the help menu in your DM!")
    }

    async executePrivate(message:DMMessage, args: string[]){
        this.sendHelp(message.user.id, args[0])
    }

    async sendHelp(user_id:string, command:string){
        if(command){
            const cmd = commands.get(command)
            if(cmd){
                await createDM(user_id, `[Command Details]
        
Usage:
.${command} ${cmd.usage}

${cmd.extended_description}${
    cmd.alias[0] !== command ? `\n\nAlias of the ${cmd.alias[0]} command` : ""
}`)
                return
            }
        }
        await createDM(user_id, `[Command Overview]
Use .help {command} to know more about a certain command.
        
${rawCommands.map(cmd => {
    return `.${cmd.alias[0]} ${cmd.usage}`
}).join("\n")}`)
    }
}