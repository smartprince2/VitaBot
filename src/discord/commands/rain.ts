import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { throwFrozenAccountError } from "../util";
import Tip from "../../models/Tip";
import { getActiveUsers } from "../ActiviaManager";
import { BulkSendResponse, requestWallet } from "../../libwallet/http";
import { parseAmount } from "../../common/amounts";

export default new class RainCommand implements Command {
    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.
**The minimum amount to rain is 100 ${tokenNameToDisplayName("VITC")}**

Examples:
**Rain 1000 ${tokenNameToDisplayName("VITC")} !**
.vrain 1000`

    alias = ["vrain", "rain", "vitaminrain"]
    usage = "<amount>"

    async execute(message:Message, args: string[], command: string){
        if(!message.guild){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const amountRaw = args[0]
        if(!amountRaw){
            await help.execute(message, [command])
            return
        }
        const amount = parseAmount(amountRaw, tokenIds.VITC)
        if(amount.isLessThan(50)){
            await message.reply(`The minimum amount to rain is **50 ${tokenNameToDisplayName("VITC")}**.`)
            return
        }
        const userList = (await getActiveUsers(message.guildId))
            .filter(e => e !== message.author.id)
        if(userList.length < 5){
            await message.reply(`There are less than **5 active users** (${userList.length} active users). Cannot rain.`)
            return
        }
        const individualAmount = new BigNumber(
            amount.div(userList.length)
            .times(100).toFixed(0)
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
            const balances = await requestWallet("get_balances", address.address)
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
            const rawIndividualAmount = convert(individualAmount, "VITC", "RAW")
            const txs:BulkSendResponse = await requestWallet(
                "bulk_send",
                address.address, 
                addresses.map(e => [
                    e.address,
                    rawIndividualAmount
                ]),
                token
            )
            await Tip.create({
                amount: parseFloat(
                    convert(totalAskedRaw, "RAW", "VITC")
                ),
                user_id: message.author.id,
                date: new Date(),
                txhash: txs[0][0].hash
            })
            try{
                await message.react("909408282307866654")
            }catch{}
            try{
                await message.reply(`Distributed ${convert(totalAskedRaw, "RAW", "VITC")} VITC amongst ${userList.length} active members!`)
            }catch{}
        })
    }
}
