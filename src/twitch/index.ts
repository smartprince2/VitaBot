import "../common/load-env"
import { dbPromise } from "../common/load-db"
import Command from "./command"
import { promises as fs } from "fs"
import { join } from "path"
import { walletConnection } from "../cryptocurrencies/vite"
import Address from "../models/Address"
import { tokenTickers } from "../common/constants"
import { convert, tokenNameToDisplayName } from "../common/convert"
import { parseTransactionType } from "../wallet/address"
import { Client } from "tmi.js"

export const client = new Client({
    options: {
        debug: true
    },
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: "vitctipbot",
        password: process.env.TWITCH_AUTH_TOKEN
    },
    channels: ["vitctipbot"]
})

export const commands = new Map<string, Command>()
export const rawCommands = [] as Command[]

let nonce = 0

fs.readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(const file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }
    // wait for db before launching bot
    
    await dbPromise

    await client.connect()

    walletConnection.on("tx", async transaction => {
        if(transaction.type !== "receive")return
        
        const address = await Address.findOne({
            address: transaction.to
        })
        // shouldn't happen but
        if(!address)return

        // Don't send dm on random coins, for now just tell for registered coins.
        if(!(transaction.token_id in tokenTickers))return
        
        const tokenName = tokenTickers[transaction.token_id]
        const displayNumber = convert(
            transaction.amount, 
            "RAW", 
            tokenName
        )
        let text = `

View transaction on vitescan: https://vitescan.io/tx/${transaction.hash}`

        const sendingAddress = await Address.findOne({
            address: transaction.from,
            network: "VITE"
        })
        const notif = parseTransactionType(sendingAddress?.handles?.[0], transaction.sender_handle)
        text = notif.text
            .replace(/\*+/g, "")
            .replace("{amount}", `${displayNumber} ${tokenNameToDisplayName(tokenName)}`)
            + text
        if(notif.type === "tip"){
            let mention = ""
            if(notif.platform == "Discord"){
                mention = `https://discord.com/users/${notif.id}`
            }else if(notif.platform == "Twitter"){
                mention = `https://twitter.com/i/user/${notif.id}`
            }else{
                mention = `${notif.platform}:${notif.id}`
            }
            text = text.replace("{mention}", mention)
        }
        for(const handle of address.handles){
            const [id, service] = handle.split(".")
            switch(service){
                case "Twitch": {
                    await client.whisper(id, text)
                }
            }
        }
    })
    
    

    client.on("message", async (channel, tags, message, self) => {
        if(false || tags["message-type"] === "action")return

        if(!message.startsWith("!"))return
        const args = message.slice(1).split(/ +/g)
        const command = args.shift().toLowerCase()

        const cmd = commands.get(command)

        switch(tags["message-type"]){
            case "whisper": {
                if(!cmd?.dm)return
                
                const n = nonce++

                try{
                    await cmd.executePrivate(channel, tags, args, command)
                }catch(err){
                    console.error(`${command} Twitch ${n}`, err)
                    await client.say(channel, `An unknown error occured. Please report that to my devs. Execution ID ${n}`)
                }
                break
            }
            case "chat": {
                if(!cmd?.public)return
                
                const n = nonce++

                try{
                    await cmd.executePublic(channel, tags, args, command)
                }catch(err){
                    if(!(err instanceof Error) && "error" in err){
                        // eslint-disable-next-line no-ex-assign
                        err = JSON.stringify(err.error, null, "    ")
                    }
                    console.error(`${command} Twitch ${n}`, err)
                    await client.say(channel, `An unknown error occured. Please report that to my devs. Execution ID ${n}`)
                }
            }
        }
    })
})