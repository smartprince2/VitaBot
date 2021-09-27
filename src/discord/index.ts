import "../common/load-env"
import Discord, { Collection, TextChannel } from "discord.js"
import {promises as fs} from "fs"
import { join } from "path"
import Command from "./command"
import { generateDefaultEmbed, parseDiscordUser } from "./util"
import { tokenTickers, VITABOT_GITHUB } from "../common/constants"
import { dbPromise } from "../common/load-db"
import { FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD, initFaucet } from "./faucet"
import { searchAirdrops } from "./AirdropManager"
import { durationUnits } from "../common/util"
import { searchGiveaways } from "./GiveawayManager"
import { walletConnection } from "../cryptocurrencies/vite"
import Address from "../models/Address"
import { convert, tokenNameToDisplayName } from "../common/convert"
import { VITC_ADMINS } from "./constants"
import { parseTransactionType } from "../wallet/address"

export const client = new Discord.Client({
    allowedMentions: {
        repliedUser: true
    },
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MEMBERS
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
            name: "Popping pills 💊",
            type: "PLAYING"
        }]
    }
})

export const commands = new Collection<string, Command>()
export const rawCommands = [] as Command[]
let botRegexp:RegExp = null

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`)

    botRegexp = new RegExp("^<@!?"+client.user.id+">$")

    initFaucet()
    
    searchAirdrops()
    .catch(()=>{})

    searchGiveaways()
    .catch(console.error)
    // every hour
    setTimeout(searchAirdrops, durationUnits.h)

    walletConnection.on("sbp_rewards", async message => {
        const channel = client.channels.cache.get("888496337799245874") as TextChannel
        if(!channel)return
        const text = `Today's 💊 voter rewards were sent!

**${Math.round(parseFloat(convert(message.vite, "RAW", "VITE")))} ${tokenNameToDisplayName("VITE")}**!

And

**${Math.round(parseFloat(convert(message.vitc, "RAW", "VITC")))} ${tokenNameToDisplayName("VITC")}**!

Thanks to all our voters!`

        const msg = await channel.send(text)
        await msg.crosspost()
    })
    
    walletConnection.on("tx", async transaction => {
        if(transaction.type !== "receive")return
        
        const address = await Address.findOne({
            address: transaction.to
        })
        // shouldn't happen but
        if(!address)return

        if(!(transaction.token_id in tokenTickers))return
        
        const tokenName = tokenTickers[transaction.token_id]
        const displayNumber = convert(
            transaction.amount, 
            "RAW", 
            tokenName
        )
        let text = `

View transaction on vitescan: https://vitescan.io/tx/${transaction.hash}`

        const sendingAddress = await Address.findOne({
            address: transaction.from,
            network: "VITE"
        })
        const notif = parseTransactionType(sendingAddress?.handles?.[0], transaction.sender_handle)
        text = notif.text
            .replace("{amount}", `${displayNumber} ${tokenNameToDisplayName(tokenName)}`)
            + text
        if(notif.type === "tip"){
            let mention = ""
            if(notif.platform == "Discord"){
                const user = (await parseDiscordUser(notif.id))[0]
                if(user)mention = user.tag
            }else if(notif.platform == "Twitter"){
                mention = `https://twitter.com/i/user/${notif.id}`
            }else{
                mention = `${notif.platform}:${notif.id}`
            }
            text = text.replace("{mention}", mention)
        }
        for(const handle of address.handles){
            const [id, service] = handle.split(".")
            switch(service){
                case "Discord": {
                    const user = client.users.cache.get(id)
                    if(!user)return
                    user.send(text).catch(()=>{})
                    break
                }
            }
        }
    })
})

const prefix = process.env.DISCORD_PREFIX
client.on("messageCreate", async message => {
    if([FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD].includes(message.author.id)){
        if(!VITC_ADMINS.includes(message.author.id))return
    }
    if(botRegexp.test(message.content)){
        message.reply("Hi! If you're wondering, my prefix is `"+prefix+"`! You can see my list of commands by doing `"+prefix+"help`! 💊")
        return
    }
    if(!message.content.startsWith(prefix))return
    if(message.author.bot)return
    const args = message.content.slice(prefix.length).trim().split(/ +/g)
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

        if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }
    // wait for db before launching bot
    await dbPromise
    await client.login(process.env.DISCORD_TOKEN)
})