/**
 * This file is used to detect abusers of faucets.
 * We map their addresses to their discord/twitter accounts.
 */

import "../common/load-env"
import "../common/load-db"
import { dbPromise } from "../common/load-db"
import Address from "../models/Address"
import { Client } from "discord.js"
import * as fs from "fs"

const client = new Client({
    intents: []
})
client.token = process.env.DISCORD_TOKEN
dbPromise.then(async () => {
    const data = []
    const addresses = await Address.find()
    for(const address of addresses){
        const handles = []
        data.push({
            address: address.address,
            handles: address.handles,
            resolvedhandles: handles
        })
        for(const handle of address.handles){
            console.log("Mapping "+handle)
            const [id, platform] = handle.split(".")
            switch(platform){
                case "Discord": {
                    try{
                        const user = await client.users.fetch(id)
                        handles.push({
                            platform: "Discord",
                            tag: user.tag
                        })
                    }catch{}
                    break
                }
                case "Faucet": {
                    handles.push({
                        platform: "Faucet",
                        tag: id
                    })
                }
            }
        }
    }
    console.log("Finished mapping users.")
    fs.writeFileSync("./users.json", JSON.stringify(data))
})