import { client } from "."
import * as lt from "long-timeout"
import { randomFromArray, wait } from "../common/util"
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../cryptocurrencies/vite"
import viteQueue from "../cryptocurrencies/viteQueue"
import discordqueue from "./discordqueue"
import { TextChannel } from "discord.js"
import { convert, tokenIdToName, tokenNameToDisplayName } from "../common/convert"
import Giveaway, { IGiveaway } from "../models/Giveaway"
import ActionQueue from "../common/queue"
import { generateDefaultEmbed } from "./util"
import GiveawayEntry from "../models/GiveawayEntry"
import GiveawayWinner from "../models/GiveawayWinner"

export const watchingGiveawayMap = new Map<string, IGiveaway>()
export const timeoutsGiveway = new Map<string, lt.Timeout>()
export const resolveGiveaway = new Map<string, ()=>void>()

export const giveawayQueue = new ActionQueue<string>()

export async function searchGiveaways(){
    const giveaways = await Giveaway.find({})
    for(const giveaway of giveaways){
        const message_id = giveaway.message_id
        if(watchingGiveawayMap.has(message_id))continue
        console.log(giveaway)
        watchingGiveawayMap.set(message_id, giveaway)
        giveawayQueue.queueAction("current", async () => {
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
        return getBalances(giveawayLockAccount.address)
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

const giveaway_channels = {
    "862416292760649768": "862416292760649773 870900472557502474 871022892832407602 871017878802014258 877465940474888212 878373710174773308     872195770076512366".split(" ")
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
        await viteQueue.queueAction(address.address, async () => {
            const balances = await getBalances(address.address)
            const tokenIds = Object.keys(balances)
            const hashes = []
            while(tokenIds[0]){
                const token = tokenIds.shift()
                const hash = await sendVITE(
                    address.seed,
                    recipient.address,
                    balances[token],
                    token
                )
                hashes.push(hash)
                if(tokenIds[0])await wait(10000)
            }
        })
        const channel = client.channels.cache.get(giveaway.channel_id) as TextChannel
        if(!channel){
            throw new GiveawayError(`Couldn't find the corresponding channel. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
        }
        try{
            await refreshBotEmbed(giveaway)
        }catch{}
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
            await GiveawayWinner.create({
                message_id: giveaway.message_id,
                user_id: winningEntry.user_id,
                date: new Date(),
                announce_id: msg.id,
                channel_id: giveaway.channel_id,
                guild_id: giveaway.guild_id
            })
        }catch{}
    }catch(err){
        console.error(err)
        throw new GiveawayError(`An error occured with the giveaway. Ask the admins to unlock Giveaway ${giveaway.message_id}'s funds.`)
    }
}