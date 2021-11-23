import { Message } from "discord.js";
import { tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";
import { tokenPrices } from "../../common/price";
import BigNumber from "bignumber.js";

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
        if(tokenIds["VINU-000"]){
            delete balances[tokenIds["VINU-000"]]
        }
        const lines = [
            //"**Currency**",
            //""
        ]
        let maxLength1 = 0//lines[0].length-4
        for(const tokenId in balances){
            const name = tokenNameToDisplayName(tokenId)
            lines.push(`**${name}**`)
            maxLength1 = Math.max(maxLength1, name.length)
        }
        //lines[0] += /*" ".repeat(maxLength1-lines[0].length)+*/" **Balance**"
        let i = 0
        let totalPrice = new BigNumber(0)
        for(const tokenId in balances){
            let line = lines[i]
            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            const pair = tokenPrices[tokenId+"/"+tokenIds.USDT]

            const fiat = new BigNumber(pair?.closePrice || 0)
                .times(displayBalance)
                .toFixed(2, BigNumber.ROUND_DOWN)
            const bal = `${displayBalance} ${tokenTickers[tokenId] ? `**${tokenTickers[tokenId]}** ` : ""}(= **$${
                fiat
            }**)`
            line += /*" ".repeat(maxLength1-line.length+4)+*/" "+bal
            lines[i] = line
            i++
            totalPrice = totalPrice.plus(fiat)
        }
        lines.push("")
        lines.push(`Total Value: **$${totalPrice.toFixed(2)}**`)

        const embed = generateDefaultEmbed()
        .setAuthor("View on vitescan.io", undefined, `https://vitescan.io/address/${address.address}`)
        /*.addField("Currency", Object.keys(balances).map(tokenId => {
            const displayToken = tokenId

            return `**${tokenNameToDisplayName(displayToken)}**`
        }).join("\n"), true)
        .addField("Balance", Object.keys(balances).map(tokenId => {
            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            const pair = tokenPrices[tokenId+"/"+tokenIds.USDT]

            return `${displayBalance} ${tokenTickers[tokenId] ? `**${tokenTickers[tokenId]}** ` : ""}(= **$${
                new BigNumber(
                    new BigNumber(pair?.closePrice || 0)
                        .times(displayBalance)
                        .times(100)
                        .toFixed(0)
                ).div(100)
                .toFixed()
            }**)`
        }).join("\n"), true)*/
        .setDescription(lines.join("\n"))
        await message.author.send({
            embeds: [embed]
        })
        if(message.guild){
            message.reply("I've sent your balance in your DM!")
        }
    }
}