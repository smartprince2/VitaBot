import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { client } from "..";
import rain from "./rain";
import { randomFromArray } from "../../common/util";

export default new class Giveaway implements Command {
    description = "Start a new giveaway"
    extended_description = `Start a new giveaway !
You must have a @Giveaway role.

Examples:
**Start a ${tokenNameToDisplayName("VITC")} !**
.vrandom 50`

    alias = ["giveaway", "gs", "gstart"]
    usage = "<amount>"

    allowedGuilds = process.env.DISCORD_SERVER_IDS.split(",")
    allowedRoles = process.env.DISCORD_RAIN_ROLES.split(",")

    async execute(message:Message, args: string[], command: string){
        if(!message.guild || !this.allowedGuilds.includes(message.guild.id)){
            await message.reply(`The \`${command}\` is not enabled in this server. Please contact the bot's operator`)
            return
        }
        const amountRaw = args[0]
        if(!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw)){
            await help.execute(message, [command])
            return
        }
        const amount = new BigNumber(amountRaw)
        const userList = Object.keys(rain.activeList)
            .filter(e => e !== message.author.id)
        if(userList.length < 2){
            await message.reply(`There are less than 2 active users. Cannot random tip. List of active users is: ${userList.map(e => client.users.cache.get(e)?.tag).join(", ")||"empty"}`)
            return
        }
        const user = randomFromArray(userList)
        const [
            address,
            recipient
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            discordqueue.queueAction(user, async () => {
                return getVITEAddressOrCreateOne(user, "Discord")
            })
        ])
        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react("💊")
            }catch{}
            const balances = await getBalances(address.address)
            const token = tokenIds.VITC
            const balance = new BigNumber(balances[token])
            const totalAskedRaw = new BigNumber(convert(amount, "VITC", "RAW").split(".")[0])
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `You don't have enough money to cover this tip. You need ${amount.toFixed()} VITC but you only have ${convert(balance, "RAW", "VITC")} VITC in your balance. Use .deposit to top up your account.`
                )
                return
            }
            await sendVITE(
                address.seed,
                recipient.address,
                totalAskedRaw.toFixed(),
                token
            )
            try{
                await message.react("873558842699571220")
            }catch{}
            try{
                await message.author.send({
                    content: `Tipped ${convert(totalAskedRaw, "RAW", "VITC")} VITC to <@${user}> !`,
                    allowedMentions: {
                        users: [user]
                    }
                })
            }catch{}
        })
    }
}