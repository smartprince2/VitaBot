import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { bulkSend, getBalances, getVITEAddressOrCreateOne } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { client } from "..";
import { throwFrozenAccountError } from "../util";
import Tip from "../../models/Tip";
import ActiveStats from "../../models/ActiveStats";
import activeQueue from "../activeQueue";
import ActiveStatus from "../../models/ActiveStatus";
import { durationUnits } from "../../common/util";
import toptippers from "./toptippers";
import ActiviaFreeze from "../../models/ActiviaFreeze";

export default new class Rain implements Command {
    constructor(){
        client.on("messageCreate", async message => {
            const content = message.content
            .replace(/<@!?\d+>|@(everyone|here)|<@&\d+>|<#\d+>|<a?:[\w\d_]+:\d+>/g, "")
            if(!content || content.length < 2)return
            if(
                !message.guild ||
                message.author.bot || 
                !this.allowedGuilds.includes(message.guild.id)
            )return
            if(/^[?.!]\w+/.test(content))return

            let hasRole = false
            const member = await message.member.fetch().catch(() => null)
            if(!member)return
            for(const role of this.allowedRoles){
                if(!member.roles.cache.has(role))continue
                hasRole = true
                break
            }
            if(!hasRole)return

            await activeQueue.queueAction(message.author.id, async () => {
                const frozen = await ActiviaFreeze.findOne({
                    user_id: message.author.id
                })
                if(frozen)return
                await ActiveStats.create({
                    user_id: message.author.id,
                    message_id: message.id,
                    createdAt: new Date(),
                    num: 1
                })
                const numOfActives = await ActiveStats.countDocuments({
                    user_id: message.author.id,
                    createdAt: {
                        $gt: new Date(Date.now()-durationUnits.m*5)
                    }
                })
                if(numOfActives >= 5){
                    const active = await ActiveStatus.findOne({
                        user_id: message.author.id
                    })
                    if(active){
                        active.createdAt = new Date()
                        await active.save()
                    }else{
                        await ActiveStatus.create({
                            user_id: message.author.id,
                            createdAt: new Date()
                        })
                    }
                }
            })
        })
        client.on("messageDelete", async message => {
            if(!message.content || message.content.length < 3)return
            if(
                !message.guildId ||
                !this.allowedGuilds.includes(message.guildId)
            )return

            await activeQueue.queueAction(message.author.id, async () => {
                const doc = await ActiveStats.findOne({
                    message_id: message.id
                })
                if(!doc)return
                await doc.delete()
                const numOfActives = await ActiveStats.countDocuments({
                    user_id: message.author.id
                })
                if(numOfActives < 5){
                    const active = await ActiveStatus.findOne({
                        user_id: message.author.id
                    })
                    if(active){
                        await active.delete()
                    }
                }
            })
        })
    }

    async getActiveUsers():Promise<string[]>{
        const users = await ActiveStatus.find({
            createdAt: {
                $gt: new Date(Date.now()-durationUnits.m*30)
            }
        })
        return users.map(e => e.user_id)
        .filter(e => !toptippers.admins.includes(e))
    }

    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.
**The minimum amount to rain is 1k ${tokenNameToDisplayName("VITC")}**

Examples:
**Rain 1000 ${tokenNameToDisplayName("VITC")} !**
.vrain 1000`

    alias = ["vrain", "rain", "vitaminrain"]
    usage = "<amount>"

    allowedGuilds = process.env.DISCORD_SERVER_IDS.split(",")
    allowedRoles = process.env.DISCORD_RAIN_ROLES.split(",")

    async execute(message:Message, args: string[], command: string){
        if(!message.guild || !this.allowedGuilds.includes(message.guild.id)){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const amountRaw = args[0]
        if(!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw)){
            await help.execute(message, [command])
            return
        }
        const amount = new BigNumber(amountRaw)
        if(amount.isLessThan(100)){
            await message.reply("The minimum amount to rain is 100 VITC.")
            return
        }
        const userList = (await this.getActiveUsers())
            .filter(e => e !== message.author.id)
        if(userList.length < 2){
            await message.reply(`There are less than 2 active users. Cannot rain. List of active users is: ${userList.map(e => client.users.cache.get(e)?.tag).join(", ")}`)
            return
        }
        const individualAmount = new BigNumber(
            amount.div(userList.length)
            .times(100).toFixed()
            .split(".")[0]
        ).div(100)
        const totalAsked = individualAmount.times(userList.length)
        const [
            address,
            addresses
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            Promise.all(userList.map(id => {
                return discordqueue.queueAction(id, async () => {
                    return getVITEAddressOrCreateOne(id, "Discord")
                })
            }))
        ])

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react("💊")
            }catch{}
            const balances = await getBalances(address.address)
            const token = tokenIds.VITC
            const balance = new BigNumber(balances[token] || 0)
            const totalAskedRaw = new BigNumber(convert(totalAsked, "VITC", "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `You don't have enough money to cover this tip. You need ${totalAsked.toFixed()} VITC but you only have ${convert(balance, "RAW", "VITC")} VITC in your balance. Use .deposit to top up your account.`
                )
                return
            }
            const hashes = await bulkSend(
                address, 
                addresses.map(e => e.address), 
                convert(individualAmount, "VITC", "RAW"), 
                token
            )
            const hash = hashes[0]
            await Tip.create({
                amount: parseFloat(
                    convert(totalAskedRaw, "RAW", "VITC")
                ),
                user_id: message.author.id,
                date: new Date(),
                txhash: hash
            })
            try{
                await message.react("873558842699571220")
            }catch{}
            try{
                await message.reply(`Distributed ${convert(totalAskedRaw, "RAW", "VITC")} VITC amongst ${userList.length} active members!`)
            }catch{}
        })
    }
}
