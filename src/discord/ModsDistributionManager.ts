import { durationUnits } from "../common/util"
import lt from "long-timeout"
import { dbPromise } from "../common/load-db"
import PersonalAddress from "../models/PersonalAddress"
import { convert, tokenNameToDisplayName } from "../common/convert"
import ModsBonus from "../models/ModsBonus"
import BigNumber from "bignumber.js"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import { requestWallet } from "../libwallet/http"
import { tokenIds, tokenTickers } from "../common/constants"
import { TextChannel } from "discord.js"
import { client } from "."
import { BOT_OWNER } from "./constants"
import { walletConnection } from "../cryptocurrencies/vite"
import viteQueue from "../cryptocurrencies/viteQueue"

let nextMonday = new Date("2021-10-11T00:00:00")
while(nextMonday.getTime() < Date.now()){
    nextMonday = new Date(nextMonday.getTime()+durationUnits.w)
}

function getChannel():TextChannel{
    return client.channels.cache.get("897378536686506034") as TextChannel
}

function nextMondayTask(){
    lt.setTimeout(async () => {
        // We're on monday 00:00
        // set the next monday
        setTimeout(() => {
            nextMonday = new Date(nextMonday.getTime()+durationUnits.w)
            // loop for next monday.
            nextMondayTask()
        }, 10000)
        // time to distribute
        const [
            addresses,
            distributionAddress
        ] = await Promise.all([
            PersonalAddress.find({
                platform: "Discord"
            }),
            viteQueue.queueAction("Mods.Rewards", () => getVITEAddressOrCreateOne("Mods", "Rewards"))
        ])
        const payouts = []
        const baseAmount = new BigNumber(convert("30000", "VITC", "RAW"))
        const bonusAmount = new BigNumber(convert("10000", "VITC", "RAW"))
        const bonusTotal = []
        const deletePromises = []
        let totalAmount = new BigNumber(0)

        await Promise.all(addresses.map(async address => {
            // 30k vitc
            let amount = baseAmount
            const bonuses = await ModsBonus.find({
                platform: address.platform,
                id: address.id
            })
            for(const bonus of bonuses){
                amount = amount.plus(bonusAmount)
                bonusTotal.push(bonus)
                deletePromises.push(() => bonus.delete())
            }
            totalAmount = totalAmount.plus(amount)
            payouts.push([
                address.address,
                amount.toFixed()
            ])
        }))
        await viteQueue.queueAction(distributionAddress.address, async () => {
            const balances = await requestWallet("get_balances", distributionAddress.address)
            const balance = new BigNumber(balances[tokenIds.VITC]||0)
            const channel = getChannel()
            const kript = "112006418676113408"
            if(balance.isLessThan(totalAmount)){
                // panic, we don't have enough money.
                // we still have bonuses saved for next time, and 
                // thomiz can still trigger that code, so I guess I'll just 
                // alert kript about it in Vitamin Coin's server lol.
                if(!channel)return
                await channel.send({
                    content: `<@${kript}> Mods Distribution's balance is too low. Please top it up.
    
Also ask <@${BOT_OWNER}> to trigger the distribution code.`,
                    allowedMentions: {
                        users: [kript, BOT_OWNER]
                    }
                })
                return
            }
            if(balance.dividedBy(3).isLessThan(totalAmount)){
                // We will not have enough money in 2 weeks, tell kript.
                if(channel){
                    await channel.send({
                        content: `<@${kript}> Mods Distribution's balance will run out in less than ~2 weeks. Please top it up.`,
                        allowedMentions: {
                            users: [kript]
                        }
                    })
                    await channel.send(distributionAddress.address)
                }
            }
            await Promise.all(deletePromises.map(e => e()))
    
            await requestWallet("bulk_send", distributionAddress.address, payouts, tokenIds.VITC)
    
            if(channel){
                const bonusText = bonusTotal.length > 0 ? bonusTotal.map((bonus) => {
                    return `+10k <@${bonus.id}>: ${bonus.reason}`
                }).join("\n") : "No bonuses were found. Everyone got the same pay."
                await channel.send(`**Team's weekly distribution** was sent!
    
A total of ${convert(totalAmount, "RAW", "VITC")} ${tokenNameToDisplayName("VITC")} was sent!

**BONUSES**
${bonusText}`)
            }
        })
    }, nextMonday.getTime()-Date.now())
}

(async () => {
    await dbPromise

    nextMondayTask()

    const distributionAddress = await viteQueue.queueAction("Mods.Rewards", () => getVITEAddressOrCreateOne("Mods", "Rewards"))
    walletConnection.on("tx", async tx => {
        // also easier to just handle vite txs in this file instead
        // of creating another module.
        if(tx.to !== distributionAddress.address || tx.type !== "receive")return
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", tokenTickers[tx.token_id])} ${tokenTickers[tx.token_id]} into mods reward address.`)
        if(tx.token_id !== tokenIds.VITE)return
        await viteQueue.queueAction(distributionAddress.address, async () => {
            const addresses = await PersonalAddress.find({
                platform: "Discord"
            })
            if(addresses.length === 0)return
            const balances = await requestWallet("get_balances", distributionAddress.address)
            const balance = new BigNumber(balances[tokenIds.VITE]||0)
            const amountPerPerson = new BigNumber(balance)
                .dividedBy(addresses.length)
                .toFixed()
                .split(".")[0]
            // can't split equally.
            if(amountPerPerson === "0")return

            const totalVite = new BigNumber(amountPerPerson).times(addresses.length)
            const payouts = addresses.map(e => {
                return [
                    e.address,
                    amountPerPerson
                ] as [string, string]
            })

            await requestWallet("bulk_send", distributionAddress.address, payouts, tokenIds.VITE)

            const channel = getChannel()
            if(!channel)return

            await channel.send(`**Team's daily VITE Distribution** was sent!

Today, **${convert(totalVite, "RAW", "VITE")} ${tokenNameToDisplayName("VITE")}** was split between **${addresses.length}** mods!
Everyone received **${convert(amountPerPerson, "RAW", "VITE")} ${tokenNameToDisplayName("VITE")}**.`)
        })
    })
})()
