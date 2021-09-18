import { client } from "."
import { tokenIds } from "../common/constants"
import * as lt from "long-timeout"
import { getVITEAddressOrCreateOne } from "../cryptocurrencies/vite"
import viteQueue from "../cryptocurrencies/viteQueue"
import Airdrop, { IAirdrop } from "../models/Airdrop"
import discordqueue from "./discordqueue"
import { TextChannel } from "discord.js"
import { convert } from "../common/convert"
import BigNumber from "bignumber.js"
import { requestWallet } from "../libwallet/http"

export const watchingAirdropMap = new Map<string, IAirdrop>()
export const timeoutsAirdrop = new Map<string, lt.Timeout>()

export async function searchAirdrops(){
    const airdrops = await Airdrop.find({})
    for(const airdrop of airdrops){
        if(watchingAirdropMap.has(airdrop.message_id))continue
        watchingAirdropMap.set(airdrop.message_id, airdrop)
        if(!timeoutsAirdrop.has(airdrop.message_id)){
            timeoutsAirdrop.set(airdrop.message_id, lt.setTimeout(() => {
                // Airdrop should have ended!
                endAirdrop(airdrop)
            }, airdrop.date.getTime()-Date.now()))
        }
    }
}

export async function endAirdrop(airdrop:IAirdrop){
    try{
        await airdrop.delete()
        watchingAirdropMap.delete(airdrop.message_id)
        timeoutsAirdrop.delete(airdrop.message_id)
        const channel = client.guilds.cache.get(airdrop.guild_id)?.channels.cache.get(airdrop.channel_id) as TextChannel
        if(!channel){
            await refundAirdrop(airdrop)
            return
        }
        const message = await channel.messages.fetch(airdrop.message_id)
        const embed = message.embeds[0]
        if(!embed)throw new Error(`No embed has been found on the airdrop message ${airdrop.guild_id}/${airdrop.channel_id}/${airdrop.message_id}`)
        const reaction = message.reactions.cache.get("💊")
        await reaction.fetch()
        const users = await reaction.users.fetch({
            limit: 100
        })
        const validUsers = []
        for(const user of users.values()){
            if(user.bot || user.system)continue
            if(validUsers.length > airdrop.winners)break
            validUsers.push(user)
        }
        if(validUsers.length === 0){
            embed.setDescription(`Airdrop Ended!
Ended at <t:${Math.floor(airdrop.date.getTime()/1000)}>
Winners: 0
Amount: ${convert(airdrop.amount, "RAW", "VITC")} VITC`)
            await message.edit({
                embeds: [embed]
            })
            await refundAirdrop(airdrop)
            return
        }
        const individualAmountNotRounded = convert(
            new BigNumber(airdrop.amount).div(validUsers.length),
            "RAW",
            "VITC"
        )
        const individualAmount = convert(new BigNumber(
            new BigNumber(individualAmountNotRounded)
            .times(100).toFixed().split(".")[0]
        ).div(100), "VITC", "RAW")
        const airdropLockAddress = await discordqueue.queueAction(airdrop.user_id, async () => {
            return getVITEAddressOrCreateOne(airdrop.user_id, "Discord.Airdrop")
        })
        const recipients = await Promise.all(validUsers.map(user => {
            return discordqueue.queueAction(user.id, () => {
                return getVITEAddressOrCreateOne(user.id, "Discord")
            })
        }))
        embed.setDescription(`Airdrop Ended!
Ended at <t:${Math.floor(airdrop.date.getTime()/1000)}>
Winners: ${validUsers.length}
Amount: ${convert(airdrop.amount, "RAW", "VITC")} VITC
Currently: distributing rewards. Please wait...`)
        await message.edit({
            embeds: [embed]
        })
        try{
            await viteQueue.queueAction(airdropLockAddress.address, async () => {
                await requestWallet(
                    "bulk_send",
                    airdropLockAddress.address, 
                    recipients.map(e => [
                        e.address,
                        individualAmount
                    ]),
                    tokenIds.VITC
                )
            })
        }catch(err){
            console.error(err)
        }
        embed.setDescription(`Airdrop Ended!
Ended at <t:${Math.floor(airdrop.date.getTime()/1000)}>
Winners: ${validUsers.length}
Amount: ${convert(airdrop.amount, "RAW", "VITC")} VITC
Currently: All rewards have been distributed!`)
        await message.edit({
            embeds: [embed]
        })
    }catch(err){
        console.error(err)
        try{
            await refundAirdrop(airdrop)
        }catch{}
    }
}
export async function refundAirdrop(airdrop:IAirdrop){
    const [
        airdropLockAddress,
        address
    ] = await discordqueue.queueAction(airdrop.user_id, async () => {
        return Promise.all([
            getVITEAddressOrCreateOne(airdrop.user_id, "Discord.Airdrop"),
            getVITEAddressOrCreateOne(airdrop.user_id, "Discord")
        ])
    })

    await viteQueue.queueAction(airdropLockAddress.address, async () => {
        await requestWallet(
            "send",
            airdropLockAddress.address, 
            address.address, 
            airdrop.amount, 
            tokenIds.VITC
        )
    })
}