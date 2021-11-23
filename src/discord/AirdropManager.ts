import { client } from "."
import { tokenIds } from "../common/constants"
import * as lt from "long-timeout"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import viteQueue from "../cryptocurrencies/viteQueue"
import Airdrop, { IAirdrop } from "../models/Airdrop"
import discordqueue from "./discordqueue"
import { TextChannel } from "discord.js"
import { convert, tokenIdToName, tokenNameToDisplayName } from "../common/convert"
import BigNumber from "bignumber.js"
import { requestWallet } from "../libwallet/http"
import { tokenPrices } from "../common/price"
import { generateDefaultEmbed } from "./util"

export const watchingAirdropMap = new Map<string, IAirdrop>()
export const timeoutsAirdrop = new Map<string, lt.Timeout>()

export async function searchAirdrops(){
    client.on("messageReactionAdd", async (reaction) => {
        const message = reaction.message
        const airdrop = watchingAirdropMap.get(message.id)
        if(!airdrop)return
        // substract 1 for the bot's reaction
        if(airdrop.winners <= reaction.count-1){
            // airdrop should end
            lt.clearTimeout(timeoutsAirdrop.get(message.id))
            airdrop.date = new Date()
            await endAirdrop(airdrop)
        }
    })

    const airdrops = await Airdrop.find({})
    for(const airdrop of airdrops){
        if(!client.guilds.cache.has(airdrop.guild_id))continue
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

export async function getAirdropEmbed(airdrop:IAirdrop, winners = []){
    // everything stored on-chain
    const [
        balances,
        address
    ] = await discordqueue.queueAction(airdrop.user_id, async () => {
        return getVITEAddressOrCreateOne(airdrop.message_id, "Discord.Airdrop")
    }).then(airdropLockAccount => {
        return viteQueue.queueAction(airdropLockAccount.address, async () => {
            return Promise.all([
                requestWallet("get_balances", airdropLockAccount.address),
                Promise.resolve(airdropLockAccount)
            ])
        })
    })

    const endTime = Math.floor(airdrop.date.getTime()/1000)
    const ended = airdrop.date.getTime() <= Date.now()
    let totalFiatValue = new BigNumber(0)
    const embed = generateDefaultEmbed()
    .setTitle(`Airdrop${ended ? " Ended" : ""}`)
    .setDescription(`Airdrop ${ended ? "Ended" : "Started"}!
End${ended ? "ed" : "s"} at **<t:${endTime}>** (**<t:${endTime}:R>**)
${!ended ? "Max " : ""}Winners: **${
    ended ? 
        winners.map(e => `<@${e.id}>`).slice(0, 20).join(", ") + (winners.length > 20 ? ` and ${winners.length-20} other people` : "") || "None; Airdrop was refunded." : 
        airdrop.winners+" Winners"
}**

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

[Link to Wallet](https://vitescan.io/address/${address.address})

${!ended ? "**React with 💊 to participate!**" : ""}`)
    return embed
}

export async function endAirdrop(airdrop:IAirdrop){
    try{
        watchingAirdropMap.delete(airdrop.message_id)
        timeoutsAirdrop.delete(airdrop.message_id)
        await airdrop.delete()
        const channel = client.guilds.cache.get(airdrop.guild_id)?.channels.cache.get(airdrop.channel_id) as TextChannel
        if(!channel){
            await refundAirdrop(airdrop)
            return
        }
        const message = await channel.messages.fetch(airdrop.message_id)
        const reaction = message.reactions.resolve("💊")
        await reaction.fetch()
        const validUsers = []
        let shouldFetch = true
        let lastId = null
        while(shouldFetch){
            console.log("Fetching reactions after "+lastId)
            const u = await reaction.users.fetch({
                limit: 100,
                after: lastId
            })
            if(u.size < 100){
                shouldFetch = false
            }
            if(u.size > 0){
                lastId = u.last().id
            }
            for(const user of u.values()){
                if(user.bot || user.system)continue
                if(airdrop.winners <= validUsers.length){
                    shouldFetch = false
                    break
                }
                validUsers.push(user)
            }
        }
        const embed = await getAirdropEmbed(airdrop, validUsers)
        await message.edit({
            embeds: [embed]
        })
        if(validUsers.length === 0){
            await refundAirdrop(airdrop)
            return
        }
        const airdropLockAddress = await discordqueue.queueAction(airdrop.user_id, async () => {
            return getVITEAddressOrCreateOne(airdrop.message_id, "Discord.Airdrop")
        })
        const recipients = await Promise.all(validUsers.map(user => {
            return discordqueue.queueAction(user.id, () => {
                return getVITEAddressOrCreateOne(user.id, "Discord")
            })
        }))
        try{
            await viteQueue.queueAction(airdropLockAddress.address, async () => {
                const balances = await requestWallet("get_balances", airdropLockAddress.address)
                const tokenIds = Object.keys(balances)
                while(tokenIds[0]){
                    const token = tokenIds.shift()
                    if(balances[token] === "0")continue
                    const payouts = []
                    const individualAmount = new BigNumber(balances[token])
                        .div(recipients.length)
                        .toFixed(0)
                    const leftover = new BigNumber(balances[token])
                        .minus(
                            new BigNumber(individualAmount)
                            .times(recipients.length)
                        ).toFixed(0)
                    for(const recipient of recipients){
                        if(individualAmount === "0")break
                        payouts.push([
                            recipient.address,
                            individualAmount
                        ])
                    }
                    if(leftover !== "0"){
                        const payout = payouts[0] || [
                            recipients[0].address,
                            "0"
                        ]
                        payout[1] = new BigNumber(payout[1])
                            .plus(leftover)
                            .toFixed(0)
                        payouts[0] = payout
                    }
                    if(payouts.length > 1){
                        await requestWallet(
                            "bulk_send",
                            airdropLockAddress.address, 
                            payouts,
                            token
                        )
                    }else{
                        await requestWallet(
                            "send",
                            airdropLockAddress.address, 
                            payouts[0][0], 
                            payouts[0][1], 
                            token
                        )
                    }
                }
            })
            await message.channel.send({
                content: `Airdrop Ended! *${validUsers.map(e => `<@${e.id}>`).slice(0, 50).join(", ") + (validUsers.length > 50 ? ` and ${validUsers.length-50} other people` : "")}* received ${validUsers.length > 1 ? "a split of " : ""}the prize!`,
                reply: {
                    messageReference: message.id
                },
                allowedMentions: {
                    users: validUsers.map(e => e.id).slice(0, 50)
                }
            })
        }catch(err){
            console.error(err)
        }
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
            getVITEAddressOrCreateOne(airdrop.message_id, "Discord.Airdrop"),
            getVITEAddressOrCreateOne(airdrop.user_id, "Discord")
        ])
    })

    await viteQueue.queueAction(airdropLockAddress.address, async () => {
        const balances = await requestWallet("get_balances", airdropLockAddress.address)
        const tokenIds = Object.keys(balances)
        while(tokenIds[0]){
            const token = tokenIds.shift()
            if(balances[token] === "0")continue
            await requestWallet(
                "send",
                airdropLockAddress.address, 
                address.address, 
                balances[token], 
                token
            )
        }
    })
}