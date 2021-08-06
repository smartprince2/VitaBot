import "../common/load-env"
import Discord, { Collection } from "discord.js"
import {promises as fs} from "fs"
import { join } from "path"
import Command from "./command"
import { generateDefaultEmbed } from "./util"
import { VITABOT_GITHUB } from "../common/constants"
import { dbPromise } from "../common/load-db"

export const client = new Discord.Client({
    disableMentions: "everyone",
})

export const commands = new Collection<string, Command>()
export const rawCommands = [] as Command[]

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`)
    client.user.setActivity({
        name: "Popping pills 💊",
        type: "PLAYING"
    })
})

client.on("message", async message => {
    if(!message.content.startsWith(process.env.DISCORD_PREFIX))return
    if(message.author.bot)return
    let args = message.content.trim().slice(process.env.DISCORD_PREFIX.length).split(/ +/g)
    let command = args.shift().toLowerCase()

    const cmd = commands.get(command)
    if(!cmd)return

    try{
        await cmd.execute(message, args, command)
    }catch(err){
        console.error(err)
        message.reply(
            `The command ${command} throwed an error ! Sorry for the inconvenience ! Please report this to VitaBot's github:`, 
            generateDefaultEmbed()
            .setDescription("```"+err+"```")
            .setAuthor("Go to VitaBot's github", undefined, VITABOT_GITHUB)
        )
    }
})

// Prevent stupid crashes
client.on("error", () => {})

fs.readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(let file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        rawCommands.push(command)
        for(let alias of command.alias){
            commands.set(alias, command)
        }
    }
    // wait for db before launching bot
    await dbPromise
    await client.login(process.env.DISCORD_TOKEN)
})