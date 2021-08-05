import "../common/load-env"
import Discord from "discord.js"

export const client = new Discord.Client({
    disableMentions: "everyone",
})

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`)
    client.user.setActivity({
        name: "Popping pills 💊",
        type: "PLAYING"
    })
})

client.on("message", message => {
    if(message.author.bot)return
})

client.login(process.env.DISCORD_TOKEN)