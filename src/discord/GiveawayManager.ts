import { client } from "."
import * as lt from "long-timeout"
import { durationUnits, randomFromArray } from "../common/util"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import viteQueue from "../cryptocurrencies/viteQueue"
import discordqueue from "./discordqueue"
import { TextChannel } from "discord.js"
import { convert, tokenIdToName, tokenNameToDisplayName } from "../common/convert"
import Giveaway, { IGiveaway } from "../models/Giveaway"
import ActionQueue from "../common/queue"
import { generateDefaultEmbed } from "./util"
import GiveawayEntry from "../models/GiveawayEntry"
import GiveawayWinner from "../models/GiveawayWinner"
import { requestWallet } from "../libwallet/http"
import Address from "../models/Address"
import events from "../common/events"
import asyncPool from "tiny-async-pool"
import { tokenPrices } from "../common/price"
import { tokenIds } from "../common/constants"
import BigNumber from "bignumber.js"

export const watchingGiveawayMap = new Map<string, IGiveaway>()
export const timeoutsGiveway = new Map<string, lt.Timeout>()
export const resolveGiveaway = new Map<string, ()=>void>()

export const giveawayQueue = new ActionQueue<string>()

export async function searchGiveaways(){
    const giveaways = await Giveaway.find({})
    for(const giveaway of giveaways){
        if(!client.guilds.cache.has(giveaway.guild_id))continue
        const message_id = giveaway.message_id
        if(watchingGiveawayMap.has(message_id))continue
        watchingGiveawayMap.set(message_id, giveaway)
        giveawayQueue.queueAction(giveaway.guild_id, async () => {
            const giveaway = await Giveaway.findOne({
                message_id: message_id
            })
            watchingGiveawayMap.set(message_id, giveaway)
            if(!giveaway.bot_message_id)await startGiveaway(giveaway)
            .catch(console.error)

            let resolve = () => {}
            const promise = new Promise<void>(r => {
                resolve = r
            })
            resolveGiveaway.set(message_id, resolve)
            timeoutsGiveway.set(message_id, lt.setTimeout(async () => {
                // Giveaway should have ended!
                await endGiveaway(giveaway)
                .catch(console.error)
                resolve()
            }, giveaway.creation_date.getTime()+giveaway.duration-Date.now()))
            await promise
            timeoutsGiveway.delete(message_id)
            watchingGiveawayMap.delete(message_id)
            resolveGiveaway.delete(message_id)
        })
    }
}

export class GiveawayError extends Error {
    name = "GiveawayError"
}

export async function getGiveawayEmbed(giveaway:IGiveaway){
    // everything stored on-chain
    const [
        entries,
        balances
    ] = await Promise.all([
        GiveawayEntry.find({
            message_id: giveaway.message_id
        }),
        discordqueue.queueAction(giveaway.user_id, async () => {
            return getVITEAddressOrCreateOne(giveaway.message_id, "Discord.Giveaway")
        }).then(giveawayLockAccount => {
            return viteQueue.queueAction(giveawayLockAccount.address, async () => {
                return requestWallet("get_balances", giveawayLockAccount.address)
            })
        })
    ])
    const endTime = Math.floor((giveaway.creation_date.getTime()+giveaway.duration)/1000)
    const prefix = process.env.DISCORD_PREFIX
    const ended = giveaway.creation_date.getTime()+giveaway.duration <= Date.now()
    let totalFiatValue = new BigNumber(0)
    const vitcPair = tokenPrices[tokenIds.VITC + "/" + tokenIds.USDT]
    const embed = generateDefaultEmbed()
    .setTitle("Giveaway!")
    .setDescription(`Giveaway ${ended ? "Ended" : "Started"}!
End${ended ? "ed" : "s"} at <t:${endTime}> (<t:${endTime}:R>)
Winners: 1${giveaway.fee ? 
`\n**Fee: ${giveaway.fee} ${tokenNameToDisplayName("VITC")}**` : ""} (= **$${
    new BigNumber(vitcPair?.closePrice || 0)
        .times(giveaway.fee)
        .toFixed(2, BigNumber.ROUND_DOWN)
}**)
Entries: **${entries.length} participants**
Chance of winning: **${Math.floor(1/entries.length*10000)/100}%**

${ended ? "Claimed" : "Current"} Prize(s):
${Object.entries(balances).map(tkn => {
    const pair = tokenPrices[tkn[0] + "/" + tokenIds.USDT]
    const displayBalance = convert(tkn[1], "RAW", tokenIdToName(tkn[0]))
    const fiatValue = new BigNumber(pair?.closePrice || 0)
        .times(displayBalance)
    totalFiatValue = totalFiatValue.plus(fiatValue)

    return `    **${displayBalance} ${tokenNameToDisplayName(tkn[0])}** (= **$${
        fiatValue.toFixed(2, BigNumber.ROUND_DOWN)
    }**)`
}).join("\n")}

Total Value: **$${totalFiatValue.toFixed(2, BigNumber.ROUND_DOWN)}**

\`${prefix}ticket\` to enter the current giveaway
\`${prefix}ticketstatus\` to view your entry status 
\`${prefix}giveawaystatus\` to reload this message
\`${prefix}winners\` to view recent giveaways winners
\`${prefix}donate <amount> <token>\` to donate any token to the prize pool`)
    return embed
}

export async function refreshBotEmbed(giveaway:IGiveaway){
    if(!giveaway.bot_message_id)throw new GiveawayError("This giveaway hasn't started.")
    return giveawayQueue.queueAction(giveaway.message_id, async () => {
        const channel = client.channels.cache.get(giveaway.channel_id) as TextChannel
        if(!channel){
            throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
        }
        const [
            embed,
            message
        ] = await Promise.all([
            getGiveawayEmbed(giveaway),
            channel.messages.fetch(giveaway.bot_message_id).catch(()=>null)
        ])
        try{
            await message.edit({
                embeds: [embed]
            })
        }catch{}
        return embed
    })
}

export const giveaway_channels = {
    "862416292760649768": [],
    "907279842716835881": []
}
export const giveaway_posting_channel = {
    "862416292760649768": "884088302020481074",
    "907279842716835881": "907279844319035406"
}
export const giveaways_ping_roles = {
    "862416292760649768": ["883567202492620830"],
    "907279842716835881": ["907393249965137982"]
}

export async function startGiveaway(giveaway:IGiveaway){
    const channel = client.channels.cache.get(giveaway_posting_channel[giveaway.guild_id]||giveaway.channel_id) as TextChannel
    if(!channel){
        await giveaway.delete()
        watchingGiveawayMap.delete(giveaway.message_id)
        throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
    giveaway.creation_date = new Date()
    try{
        const embed = await getGiveawayEmbed(giveaway)
        const message = await channel.send({
            embeds: [embed],
            content: (giveaways_ping_roles[giveaway.guild_id] || []).map(e => `<@&${e}>`).join("") || undefined,
            allowedMentions: {
                roles: giveaways_ping_roles[giveaway.guild_id] || []
            }
        })
        giveaway.bot_message_id = message.id
        giveaway.channel_id = message.channelId
        await giveaway.save()
        await Promise.all((giveaway_channels[channel.guildId] || []).map(async (id:string) => {
            if(id === giveaway.channel_id)return
            const channel = client.channels.cache.get(id) as TextChannel
            if(!channel)return
            await channel.send({
                content: `A giveaway has started in <#${message.channel.id}>, link: https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`
            })
        }))
    }catch(err){
        console.error("e", err)
        await giveaway.delete()
        watchingGiveawayMap.delete(giveaway.message_id)
        throw new GiveawayError(`An error occured with the giveaway. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
}

export async function endGiveaway(giveaway:IGiveaway){
    const channel = client.channels.cache.get(giveaway.channel_id) as TextChannel
    if(!channel){
        await giveaway.delete()
        watchingGiveawayMap.delete(giveaway.message_id)
        throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
    try{
        await giveaway.delete()
        watchingGiveawayMap.delete(giveaway.message_id)
        try{
            await refreshBotEmbed(giveaway)
        }catch{}
        const entries = await GiveawayEntry.find({
            message_id: giveaway.message_id
        })
        const winningEntry = randomFromArray(entries)
        if(!winningEntry)throw new GiveawayError(`No winners was found. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
        await Promise.all(entries.map(e => e.delete()))
        const [
            address,
            recipient
        ] = await Promise.all([
            discordqueue.queueAction(giveaway.user_id, async () => {
                return getVITEAddressOrCreateOne(giveaway.message_id, "Discord.Giveaway")
            }),
            discordqueue.queueAction(winningEntry.user_id, async () => {
                return getVITEAddressOrCreateOne(winningEntry.user_id, "Discord")
            })
        ])
        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const tokenIds = Object.keys(balances)
            while(tokenIds[0]){
                const token = tokenIds.shift()
                await requestWallet(
                    "send",
                    address.address,
                    recipient.address,
                    balances[token],
                    token
                )
            }
        })
        const channel = client.channels.cache.get(giveaway.channel_id) as TextChannel
        if(!channel){
            throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
        }
        const winner = await GiveawayWinner.create({
            message_id: giveaway.message_id,
            user_id: winningEntry.user_id,
            date: new Date(),
            announce_id: null,
            channel_id: giveaway.channel_id,
            guild_id: giveaway.guild_id
        })
        try{
            const msg = await channel.send({
                content: `The giveaway #${giveaway.message_id} ended! <@${winningEntry.user_id}> won!`,
                reply: {
                    messageReference: giveaway.bot_message_id,
                    failIfNotExists: false
                },
                allowedMentions: {
                    users: [winningEntry.user_id]
                }
            })
            winner.announce_id = msg.id
            await winner.save()
        }catch(err){
            console.error(err)
        }
    }catch(err){
        console.error(err)
        throw new GiveawayError(`An error occured with the giveaway. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
}


export async function searchStuckGiveaways(){
    const addresses = await Address.find({
        handles: {
            $regex: "^\\d+\\.Discord\\.Giveaway$"
        }
    })
    await asyncPool(25, addresses, async address => {
        const mess_id = address.handles[0].split(".")[0]
        const giveaway = await Giveaway.findOne({
            message_id: mess_id
        })
        if(giveaway)return

        const balances = await requestWallet("get_balances", address.address)
        const tokens = []
        for(const tokenId in balances){
            if(balances[tokenId] === "0")continue
            tokens.push(tokenId)
        }
        if(tokens.length === 0)return
        const winner = await GiveawayWinner.findOne({
            message_id: mess_id
        })
        let recipient = null
        if(!winner){
            // try to find the recipient address
            // by looking at send blocks
            const blocks = await requestWallet(
                "get_account_blocks",
                address.address,
                null,
                null,
                100
            )
            for(const block of blocks){
                // send block
                if(block.blockType !== 2)continue

                recipient = block.toAddress
                break
            }
            if(!recipient){
                console.warn(`Stuck giveaway account: ${address.address}`)
                return
            }
        }else{
            recipient = (await getVITEAddressOrCreateOne(winner.user_id, "Discord")).address
        }
        // we got the funds and the recipient, send it
        for(const token of tokens){
            await requestWallet(
                "send",
                address.address,
                recipient, 
                balances[token],
                token
            )
        }
    })
    await new Promise((resolve) => {
        lt.setTimeout(resolve, durationUnits.d)
    })
}

events.once("wallet_ready", async () => {
    // Empty stuck giveaways
    // eslint-disable-next-line no-constant-condition
    while(true){
        await searchStuckGiveaways()
    }
})