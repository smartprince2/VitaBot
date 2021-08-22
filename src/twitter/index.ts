import "../common/load-env"
import { dbPromise } from "../common/load-db"
import TwitterV2 from "twitter-v2"
import Twitter from "twitter"
import Command from "./command"
import {promises as fs} from "fs"
import {join} from "path"

export const clientv2 = new TwitterV2({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    bearer_token: process.env.TWITTER_BEARER_TOKEN
})
export const clientv1 = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

export const commands = new Map<string, Command>()
export const rawCommands = [] as Command[]

export interface Tweet {
    id: string,
    text: string
}

const handle = "@jen_wina"
let nonce = 0

async function listenForever(streamFactory, dataConsumer) {
    try {
        for await (const { data } of streamFactory()) {
            dataConsumer(data);
        }
        // The stream has been closed by Twitter. It is usually safe to reconnect.
        console.log(`[TWITTER] Stream disconnected healthily. Reconnecting.`);
        listenForever(streamFactory, dataConsumer);
    } catch (error) {
        console.warn(`[TWITTER] Stream disconnected with error. Retrying.`, error);
        listenForever(streamFactory, dataConsumer);
    }
}



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
    // wait for db before launching bo
    
    await dbPromise
    return
    // I got in a fucking infinite look of disconnection
    // TODO: Implement a delay between connections, 
    // because rate limits are going fuck you up
    listenForever(
        () => clientv2.stream("tweets/search/stream"),
        async (data) => {
            const text:string = data.text
            let args = text.split(/ +/g)
            const pos = args.indexOf(handle)
            args = args.slice(pos+1)
            let command = args.shift()
            if(!command || !command.startsWith(process.env.DISCORD_PREFIX))return
            command = command.slice(1)
            
            const cmd = commands.get(command)
            if(!cmd)return
            if(!cmd.public)return
            const n = nonce++
            try{
                await cmd.execute(data, args, command)
            }catch(err){
                console.error(`${command} Twitter ${n}`, err)
                if(!(err instanceof Error) && "error" in err){
                    // eslint-disable-next-line no-ex-assign
                    err = JSON.stringify(err.error, null, "    ")
                }
                await clientv1.post("statuses/update", {
                    status: `An unknown error occured. Please report that to devs: Execution ID ${n}`,
                    in_reply_to_status_id: data.id
                })
            }
        }
    )
})