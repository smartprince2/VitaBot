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
import { ALLOWED_GUILDS } from "../constants";
import { getActiveUsers } from "../ActiviaManager";

export default new class Rain implements Command {
    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.
**The minimum amount to rain is 1k ${tokenNameToDisplayName("VITC")}**

Examples:
**Rain 1000 ${tokenNameToDisplayName("VITC")} !**
.vrain 1000`

    alias = ["vrain", "rain", "vitaminrain"]
    usage = "<amount>"

    async execute(message:Message, args: string[], command: string){
        if(!message.guild || !ALLOWED_GUILDS.includes(message.guild.id)){
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
        const userList = (await getActiveUsers())
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
