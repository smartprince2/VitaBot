import { Message } from "discord.js";
import Command from "../command";
import { FAUCET_CHANNEL_ID, FAUCET_PAYOUT } from "../faucet";
import BigNumber from "bignumber.js"
import help from "./help";
import { convert } from "../../common/convert";
import { client } from "..";
import discordqueue from "../discordqueue";
import FaucetCooldown from "../../models/FaucetCooldown";
import { IAddress } from "../../models/Address";
import { durationUnits } from "../../common/util";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { tokenIds } from "../../common/constants";
import { BOT_OWNER } from "../constants";
import { requestWallet } from "../../libwallet/http";

export default new class ClearFaucetCommand implements Command {
    description = "Clear stuck transactions in the faucet"
    extended_description = `Unstuck the faucet.`
    alias = ["clearfaucet"]
    usage = "{messages} {amount}"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(message.author.id !== BOT_OWNER)return
        //if(message.channelId !== FAUCET_CHANNEL_ID)return
        
        let [
            messageCountRaw,
            // eslint-disable-next-line prefer-const
            amountRaw
        ] = args
        if(!messageCountRaw)messageCountRaw = "100"
        if(!/^\d+$/.test(messageCountRaw)){
            await help.execute(message, [command])
            return
        }
        const messageCount = parseInt(messageCountRaw)
        if(messageCount > 500 || messageCount === 0){
            await help.execute(message, [command])
            return
        }
        let rawAmount = FAUCET_PAYOUT
        
        if(amountRaw){
            if(!/^\d+(\.\d+)?$/.test(amountRaw)){
                await help.execute(message, [command])
                return
            }
            const amount = new BigNumber(amountRaw)
            if(amount.isGreaterThan(100)){
                await message.reply("That amount is too big.")
                return
            }

            if(amount.isLessThan(50)){
                await message.reply("That amount is too small.")
                return
            }

            rawAmount = new BigNumber(convert(amount, "VITC", "RAW"))
        }

        const messages:Message[] = []
        let remaining = messageCount
        let lastMessageId = message.id
        while(remaining > 1){
            const msgs = await message.channel.messages.fetch({
                before: lastMessageId,
                limit: remaining > 100 ? 100 : remaining
            })
            remaining = remaining-(remaining > 100 ? 100 : remaining)
            if(msgs.size === 0){
                remaining = 0
            }
            lastMessageId = msgs.last().id
            for(const message of msgs.values()){
                messages.push(message)
            }
        }

        try{
            await message.react("💊")
        }catch{}
        const recipients:IAddress[] = []
        const address = await getVITEAddressOrCreateOne("VitaBot", "Faucet")
        const validMsgs:Message[] = []
        for(let message of messages){
            if(message.author.bot){
                if(message.author.id !== client.user.id)await message.delete()
                continue
            }
            // Looks like we already tried to process that one.
            if(message.reactions.cache.has("💊")){
                if(message.reactions.cache.has("873558842699571220"))continue
            }
            message = await message.fetch()
            const isAdmin = message.member?.roles.cache.has("862755971000172579") || message.member?.roles.cache.has("871009109237960704")
            if(isAdmin)continue
            try{
                await discordqueue.queueAction(message.author.id+".faucet", async () => {
                    let cooldown = await FaucetCooldown.findOne({
                        user_id: message.author.id
                    })
                    if(cooldown){
                        if(message.createdAt.getTime() < cooldown.date.getTime() + durationUnits.d){
                            const timestamp = Math.floor((cooldown.date.getTime()+durationUnits.d)/1000)
                            await message.author.send(
                                `You will be able to post <t:${timestamp}:R>. Please wait until <t:${timestamp}> before posting again in <#${FAUCET_CHANNEL_ID}>.`
                            )
                            throw new Error()
                        }else{
                            cooldown.date = message.createdAt
                            await cooldown.save()
                        }
                    }else{
                        cooldown = await FaucetCooldown.create({
                            user_id: message.author.id,
                            date: message.createdAt
                        })
                    }
                })
            }catch{
                await message.delete()
                continue
            }
            try{
                validMsgs.push(message)
                if(!message.reactions.cache.has("💊"))await message.react("💊")
            }catch{}
            try{
                const recipient = await discordqueue.queueAction(message.author.id, async () => {
                    return getVITEAddressOrCreateOne(message.author.id, "Discord")
                })
                recipients.push(recipient)
            }catch{}
        }
        // Bulk send transactions.
        await viteQueue.queueAction(address.address, async () => {
            const totalAsked = rawAmount.times(recipients.length)
            const balances = await requestWallet("get_balances", address.address)
            const balance = new BigNumber(balances[tokenIds.VITC])
            if(balance.isLessThan(totalAsked)){
                try{
                    await message.react("❌")
                }catch{}
                for(const message of validMsgs){
                    try{
                        await message.react("❌")
                    }catch{}
                }
                await message.reply(
                    `The faucet balance is lower than the payout. Please wait until an admin tops up the account.`
                )
                return
            }
            await requestWallet(
                "bulk_send",
                address.address,
                recipients.map(e => [
                    e.address,
                    rawAmount.toFixed().split(".")[0]
                ]),
                tokenIds.VITC
            )
            try{
                await message.react("873558842699571220")
            }catch{}
            for(const message of validMsgs){
                try{
                    await message.react("873558842699571220")
                }catch{}
            }
        })
    }
}