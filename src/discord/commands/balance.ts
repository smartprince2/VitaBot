import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne } from "../../cryptocurrencies/vite";
import viteQueue from "../../cryptocurrencies/viteQueue";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";

export default new class Balance implements Command {
    description = "Get your balance"
    extended_description = "Get the balance in your tipbot account."
    alias = ["balance", "bal"]
    usage = ""

    async execute(message:Message){
        if(message.guild){
            await message.reply("Please execute this command in DMs")
            return
        }
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return await getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

        const balances = await viteQueue.queueAction(address.address, async () => {
            return await getBalances(address.address)
        })
        const embed = generateDefaultEmbed()
        .setAuthor("View on vitescan.io", undefined, `https://vitescan.io/address/${address.address}`)
        .setDescription(Object.keys(balances).map(tokenId => {
            const displayToken = Object.entries(tokenIds).find(e => e[1] === tokenId)?.[0] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            return `[**${tokenNameToDisplayName(displayToken)}**](https://vitescan.io/token/${tokenId}): ${displayBalance}`
        }).join("\n"))
        await message.channel.send({
            embeds: [embed]
        })
    }
}