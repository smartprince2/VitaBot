import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";
import * as qrcode from "qrcode"

export default new class Deposit implements Command {
    description = "Get your deposit address"
    extended_description = "Retrieve your deposit address."
    alias = ["deposit"]
    usage = ""

    async execute(message:Message){
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return await getVITEAddressOrCreateOne(message.author.id, "Discord")
        })
        const data = `vite:${address.address}`
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            qrcode.toBuffer(data, (error, buffer) => {
                if(error)return reject(error)
                resolve(buffer)
            })
        })
        const embed = generateDefaultEmbed()
        .setImage("attachment://qrcode.png")
        .setAuthor("Your deposit address")
        await message.author.send({
            content: address.address,
            embeds: [embed],
            files: [{
                attachment: buffer,
                name: "qrcode.png"
            }]
        })
        if(message.guild){
            await message.channel.send("I've sent your deposit address in your DM!")
        }
    }
}