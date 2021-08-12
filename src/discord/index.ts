import "../common/load-env"
import Discord, { Collection } from "discord.js"
import {promises as fs} from "fs"
import { join } from "path"
import Command from "./command"
import { generateDefaultEmbed } from "./util"
import { VITABOT_GITHUB } from "../common/constants"
import { dbPromise } from "../common/load-db"

export const client = new Discord.Client({
    allowedMentions: {
        repliedUser: true
    },
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES
    ],
    partials: [
        "MESSAGE",
        "USER",
        "GUILD_MEMBER",
        "REACTION",
        "CHANNEL"
    ]
})

export const commands = new Collection<string, Command>()
export const rawCommands = [] as Command[]
let botRegexp:RegExp = null

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`)
    client.user.setActivity({
        name: "Popping pills 💊",
        type: "PLAYING"
    })

    botRegexp = new RegExp("^<@!?"+client.user.id+">$")
})

const prefix = process.env.DISCORD_PREFIX
client.on("messageCreate", async message => {
    if(botRegexp.test(message.content)){
        message.reply("Hi ! If you're wondering, my prefix is `"+prefix+"` ! You can see my list of commands by doing `"+prefix+"help` ! 💊")
        return
    }
    if(!message.content.startsWith(prefix))return
    if(message.author.bot)return
    const args = message.content.trim().slice(prefix.length).split(/ +/g)
    const command = args.shift().toLowerCase()

    const cmd = commands.get(command)
    if(!cmd)return

    try{
        await cmd.execute(message, args, command)
    }catch(err){
        console.error(err)
        if(!(err instanceof Error) && "error" in err){
            // eslint-disable-next-line no-ex-assign
            err = JSON.stringify(err.error, null, "    ")
        }
        message.channel.send({
            content: `The command ${command} throwed an error ! Sorry for the inconvenience ! Please report this to VitaBot's github:`,
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
})

// Prevent stupid crashes
client.on("error", () => {})

fs.readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(const file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }
    // wait for db before launching bot
    await dbPromise
    await client.login(process.env.DISCORD_TOKEN)
})