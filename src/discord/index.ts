import "../common/load-env"
import Discord, { Collection, TextChannel } from "discord.js"
import {promises as fs} from "fs"
import { join } from "path"
import Command from "./command"
import { generateDefaultEmbed, parseDiscordUser } from "./util"
import { tokenTickers, VITABOT_GITHUB } from "../common/constants"
import { dbPromise } from "../common/load-db"
import { FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD, initFaucet } from "./faucet"
import { getAirdropEmbed, searchAirdrops, watchingAirdropMap } from "./AirdropManager"
import { durationUnits } from "../common/util"
import { searchGiveaways } from "./GiveawayManager"
import { walletConnection } from "../cryptocurrencies/vite"
import Address from "../models/Address"
import { convert, tokenNameToDisplayName } from "../common/convert"
import { VITC_ADMINS } from "./constants"
import { parseTransactionType } from "../wallet/address"
import "./ModsDistributionManager"

export const discordBotId = process.argv[2]
export const deprecatedBots = process.env.DISCORD_DEPRECATED_BOT.split(",")
export const publicBot = process.env.DISCORD_PUBLIC_BOT

export const sentHashes = new Set<string>()

export const client = new Discord.Client({
    allowedMentions: {
        repliedUser: true
    },
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
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
    // every hour
    setTimeout(searchAirdrops, durationUnits.h)
    
    searchAirdrops()
    .catch(()=>{})

    searchGiveaways()
    .catch(console.error)

    if(publicBot !== client.user.id && !deprecatedBots.includes(client.user.id)){
        // private bot
        initFaucet()

        walletConnection.on("sbp_rewards", async message => {
            const channel = client.channels.cache.get("907343213822623825") as TextChannel
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

            // don't send notifications on random coins.
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
            if(notif.type === "rewards")return
            if(notif.type === "airdrop")return
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
            const [id] = address.handles[0].split(".")
            switch(address.handles[0].split(".").slice(1).join(".")){
                case "Discord": {
                    if(notif.type === "tip" && !sentHashes.has(transaction.from_hash))break
                    const user = await client.users.fetch(id)
                    if(!user)break
                    user.send(text).catch(()=>{})
                    break
                }
                case "Discord.Airdrop": {
                    const airdrop = watchingAirdropMap.get(id)
                    if(!airdrop)return
                    const channel = client.channels.cache.get(airdrop.channel_id) as TextChannel
                    const [
                        message,
                        embed
                    ] = await Promise.all([
                        channel.messages.fetch(airdrop.message_id),
                        getAirdropEmbed(airdrop)
                    ])
                    await message.edit({
                        embeds: [embed]
                    })
                }
            }
        })
    }else if(publicBot === client.user.id){
        // public bot
        initFaucet()

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

            /*const sendingAddress = await Address.findOne({
                address: transaction.from,
                network: "VITE"
            })*/
            
            //const notif = parseTransactionType(sendingAddress?.handles?.[0], transaction.sender_handle)
            for(const handle of address.handles){
                const [id] = handle.split(".")
                switch(handle.split(".").slice(1).join(".")){
                    case "Discord.Airdrop": {
                        const airdrop = watchingAirdropMap.get(id)
                        if(!airdrop)return
                        const channel = client.channels.cache.get(airdrop.channel_id) as TextChannel
                        const [
                            message,
                            embed
                        ] = await Promise.all([
                            channel.messages.fetch(airdrop.message_id),
                            getAirdropEmbed(airdrop)
                        ])
                        await message.edit({
                            embeds: [embed]
                        })
                    }
                }
            }
        })
    }
})

const prefix = process.env.DISCORD_PREFIX
client.on("messageCreate", async message => {
    if([FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD].includes(message.channel.id)){
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
        if(deprecatedBots.includes(message.client.user.id)){
            if(message.guild){
                await message.reply(`Hi! We just changed our bots. Please add the new one here: https://discord.com/oauth2/authorize?client_id=${publicBot}&permissions=515399609408&scope=bot`)
            }else{
                await message.reply(`Hi! We just changed our bots. Please contact the new one here: <@${publicBot}>`)
            }
        }
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
        }).catch(()=>{})
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
    await client.login(process.env[`DISCORD_TOKEN_${discordBotId}`])
})