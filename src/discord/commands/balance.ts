import { Message } from "discord.js";
import { tokenIds, tokenNames, tokenTickers } from "../../common/constants";
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
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

        const balances = await viteQueue.queueAction(address.address, async () => {
            return requestWallet("get_balances", address.address)
        })
        for(const tokenId in balances){
            if(balances[tokenId] === "0")delete balances[tokenId]
        }

        if(!balances[tokenIds.VITC])balances[tokenIds.VITC] = "0"

        /*const lines = []
        let maxLength1 = 0
        for(const tokenId in balances){
            const name = tokenNameToDisplayName(tokenId)
            lines.push(name)
            maxLength1 = Math.max(maxLength1, name.length)
        }*/

        const embed = generateDefaultEmbed()
        .setAuthor("View on vitescan.io", undefined, `https://vitescan.io/address/${address.address}`)
        .addField("Currency", Object.keys(balances).map(tokenId => {
            const displayToken = tokenId

            return `**${tokenNameToDisplayName(displayToken)}**`
        }).join("\n"), true)
        .addField("Balance", Object.keys(balances).map(tokenId => {
            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            return `${displayBalance} ${tokenTickers[tokenId] ? `**${tokenTickers[tokenId]}**` : ""}`
        }).join("\n"), true)
        .setDescription(`****`)
        await message.author.send({
            embeds: [embed]
        })
        if(message.guild){
            message.reply("I've sent your balance in your DM!")
        }
    }
}