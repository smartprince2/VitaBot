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

export default new class Rain implements Command {
    constructor(){
        client.on("messageCreate", async message => {
            if(!message.content || message.content.length < 3)return
            if(
                !message.guild ||
                message.author.bot || 
                !this.allowedGuilds.includes(message.guild.id)
            )return

            let hasRole = false
            for(const role of this.allowedRoles){
                if(!message.member.roles.cache.has(role))continue
                hasRole = true
                break
            }
            if(!hasRole)return

            const stats = this.activeStats[message.author.id] = (this.activeStats[message.author.id]||0)+1
            setTimeout(() => {
                this.activeStats[message.author.id]--
                if(!this.activeStats[message.author.id]){
                    delete this.activeStats[message.author.id]
                }
            }, 5*60*1000);
            if(stats >= 5){
                if(this.activeList[message.author.id])clearTimeout(this.activeList[message.author.id])
                this.activeList[message.author.id] = setTimeout(() => {
                    delete this.activeList[message.author.id]
                }, 30*60*1000);
            }
        })
    }

    activeStats = {}
    activeList = {}

    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.
**The minimum amount to rain is 1k ${tokenNameToDisplayName("VITC")}**

Examples:
**Rain 1000 ${tokenNameToDisplayName("VITC")} !**
.vrain 1000`

    alias = ["vrain", "rain"]
    usage = "<amount>"

    allowedGuilds = process.env.DISCORD_SERVER_IDS.split(",")
    allowedRoles = process.env.DISCORD_RAIN_ROLES.split(",")

    async execute(message:Message, args: string[], command: string){
        if(!message.guild || !this.allowedGuilds.includes(message.guild.id)){
            await message.reply(`The \`${command}\` is not enabled in this server. Please contact the bot's operator`)
            return
        }
        if(![
            "696481194443014174",
            "871221803580813373",
            "112006418676113408"
        ].includes(message.author.id)){
            await message.reply("This command is currently limited.")
            return
        }
        const amountRaw = args[0]
        if(!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw)){
            await help.execute(message, [command])
            return
        }
        const amount = new BigNumber(amountRaw)
        /*if(amount.isLessThan(1000)){
            await message.reply("The minimum amount to rain is 1000 VITC.")
            return
        }*/
        const userList = ["536124399644966922", "872912021379752026"]/*Object.keys(this.activeList)
            .filter(e => e !== message.author.id)*/
        /*if(userList.length < 5){
            await message.reply(`There are less than 5 active users. Cannot rain.`)
            return
        }*/
        const individualAmount = amount.div(userList.length)
        .sd(18, BigNumber.ROUND_DOWN)
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
        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react("💊")
            }catch{}
            const balances = await getBalances(address.address)
            const token = tokenIds.VITC
            const balance = new BigNumber(balances[token])
            const totalAskedRaw = new BigNumber(convert(totalAsked, "VITC", "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                await message.channel.send({
                    content: `You don't have enough money to cover this tip. You need ${totalAsked.toFixed()} VITC but you only have ${convert(balance, "RAW", "VITC")} VITC in your balance. Use .deposit to top up your account.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            for(const recipient of addresses){
                await sendVITE(
                    address.seed, 
                    recipient.address, 
                    convert(individualAmount, "VITC", "RAW").split(".")[0], 
                    token
                )
            }
            try{
                await message.react("873558842699571220")
            }catch{}
            try{
                await message.reply(`Distributed ${convert(totalAskedRaw, "RAW", "VITC")} VITC amongst ${userList.length} active members !`)
            }catch{}
        })
    }
}