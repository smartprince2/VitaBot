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

export const watchingGiveawayMap = new Map<string, IGiveaway>()
export const timeoutsGiveway = new Map<string, lt.Timeout>()
export const resolveGiveaway = new Map<string, ()=>void>()

export const giveawayQueue = new ActionQueue<string>()

export async function searchGiveaways(){
    const giveaways = await Giveaway.find({})
    for(const giveaway of giveaways){
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
    const giveawayLockAccount = await discordqueue.queueAction(giveaway.user_id, async () => {
        return getVITEAddressOrCreateOne(giveaway.message_id, "Discord.Giveaway")
    })
    const balances = await viteQueue.queueAction(giveawayLockAccount.address, async () => {
        return requestWallet("get_balances", giveawayLockAccount.address)
    })
    const endTime = Math.floor((giveaway.creation_date.getTime()+giveaway.duration)/1000)
    const prefix = process.env.DISCORD_PREFIX
    const ended = giveaway.creation_date.getTime()+giveaway.duration < Date.now()
    const embed = generateDefaultEmbed()
    .setTitle("Giveaway!")
    .setDescription(`Giveaway ${ended ? "Ended" : "Started"}!
End${ended ? "ed" : "s"} at <t:${endTime}> (<t:${endTime}:R>)
Winners: 1${giveaway.fee ? 
`\n**Fee: ${giveaway.fee} ${tokenNameToDisplayName("VITC")}**` : ""}

${ended ? "Claimed" : "Current"} Prize(s):
${Object.entries(balances).map(tkn => {
    return `    **${convert(tkn[1], "RAW", tokenIdToName(tkn[0]))} ${tokenNameToDisplayName(tkn[0])}**`
}).join("\n")}

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
            channel.messages.fetch(giveaway.bot_message_id)
        ])
        await message.edit({
            embeds: [embed]
        })
        return embed
    })
}

export const giveaway_channels = {
    "862416292760649768": "862416292760649773 870900472557502474 877465940474888212 878373710174773308 872195770076512366 884088302020481074".split(" ")
}

export async function startGiveaway(giveaway:IGiveaway){
    const channel = client.channels.cache.get(giveaway.channel_id) as TextChannel
    if(!channel){
        await giveaway.delete()
        watchingGiveawayMap.delete(giveaway.message_id)
        throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
    giveaway.creation_date = new Date()
    try{
        const embed = await getGiveawayEmbed(giveaway)
        const message = await channel.send({
            embeds: [embed]
        })
        giveaway.bot_message_id = message.id
        await giveaway.save()
        await Promise.all((giveaway_channels[channel.guildId] || []).map(async (id:string) => {
            if(id === giveaway.channel_id)return
            const channel = client.channels.cache.get(id) as TextChannel
            if(!channel)return
            await channel.send({
                embeds: [embed]
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
        try{
            await refreshBotEmbed(giveaway)
        }catch{}
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

events.on("wallet_ready", async () => {
    // Empty stuck giveaways
    // eslint-disable-next-line no-constant-condition
    while(true){
        await searchStuckGiveaways()
    }
})