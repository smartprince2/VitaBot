import { Message } from "discord.js";
import { tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";

export default new class BalanceCommand implements Command {
    description = "Get your balance"
    extended_description = "Get the balance in your tipbot account."
    alias = ["balance", "bal"]
    usage = ""

    async execute(message:Message){
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return await getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

        const balances = await viteQueue.queueAction(address.address, async () => {
            return requestWallet("get_balances", address.address)
        })
        const embed = generateDefaultEmbed()
        .setAuthor("View on vitescan.io", undefined, `https://vitescan.io/address/${address.address}`)
        .setDescription(Object.keys(balances).map(tokenId => {
            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            return `[**${tokenNameToDisplayName(displayToken)}**](https://vitescan.io/token/${tokenId}): ${displayBalance}`
        }).join("\n"))
        await message.author.send({
            embeds: [embed]
        })
        if(message.guild){
            message.reply("I've sent your balance in your DM!")
        }
    }
}