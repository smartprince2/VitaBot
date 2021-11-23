import "../common/load-env"
import * as Discord from "discord.js"

const discordBotId = process.argv[2]
const publicBot = process.env.DISCORD_PUBLIC_BOT

const client = new Discord.Client({
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
    ],
    presence: {
        activities: [{
            name: "[DEPRECATED]",
            type: "PLAYING"
        }],
        status: "dnd"
    }
})

export const commands = new Map<string, null>()
let botRegexp:RegExp = null
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`)

    botRegexp = new RegExp("^<@!?"+client.user.id+">$")
})
const prefix = process.env.DISCORD_PREFIX
client.on("messageCreate", async message => {
    if(botRegexp.test(message.content)){
        message.reply("Hi! If you're wondering, my prefix is `"+prefix+"`! You can see my list of commands by doing `"+prefix+"help`! 💊")
        return
    }
    if(!message.content.startsWith(prefix))return
    if(message.author.bot)return

    try{
        if(!message.guild){
            await message.reply(`Hi! We just changed our bots. Please contact the new one here: <@${publicBot}>`)
        }
    }catch{}
})

// Prevent stupid crashes
client.on("error", () => {})

client.login(process.env[`DISCORD_TOKEN_${discordBotId}`])