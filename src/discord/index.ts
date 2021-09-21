import "../common/load-env"
import Discord, { Collection } from "discord.js"
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

    walletConnection.on("tx", async transaction => {
        if(transaction.type !== "receive")return
        
        const address = await Address.findOne({
            address: transaction.to
        })
        // shouldn't happen but
        if(!address)return

        // Don't send dm on random coins, for now just tell for registered coins.
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
        if(sendingAddress){
            const [id, platform, sendingVariant] = sendingAddress.handles[0].split(".")
            switch(sendingVariant){
                case "Giveaway": 
                    text = `You won ${displayNumber} ${tokenNameToDisplayName(tokenName)} from a Giveaway!`+text
                break
                default: {
                    let mention = "Unknown User"
                    switch(platform){
                        case "Quota": {
                            //let's try to resolve the original id
                            if(!transaction.sender_handle)return
                            const id = transaction.sender_handle.split(".")[0]
                            const user = (await parseDiscordUser(id))[0]
                            if(user)mention = user.tag
                            break
                        }
                        case "Discord": {
                            const user = (await parseDiscordUser(id))[0]
                            if(!user)break
                            mention = user.tag
                            break
                        }
                        case "Faucet":{
                            mention = "Faucet"
                        }
                    }text = `You were tipped **${displayNumber} ${tokenNameToDisplayName(tokenName)}** by **${mention}**!`+text
                }
            }
        }else{
            text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were deposited in your account's balance!`+text
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