import "../common/load-env"
import { dbPromise } from "../common/load-db"
import Twit from "twitter-api-v2"
import Twitter from "twitter"
import Command from "./command"
import { promises as fs } from "fs"
import { join } from "path"
import { Autohook } from "twitter-autohook"
import { walletConnection } from "../cryptocurrencies/vite"
import Address from "../models/Address"
import { tokenTickers } from "../common/constants"
import { convert, tokenNameToDisplayName } from "../common/convert"
import { fetchUser } from "./users"

export const twitc = new Twit({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})
export const client = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

export const commands = new Map<string, Command>()
export const rawCommands = [] as Command[]

export function replyTweet(reply_to: string, text: string){
    return twitc.v1.reply(text, reply_to)
}

// Broken typing on this because this payload won't work with normal Twitter, and needs twitc
export async function createDM(recipient_id: string, text: string):Promise<any>{
    return twitc.v1.sendDm({
        recipient_id: recipient_id,
        text: text
    })
}

export interface TwitterUser {
    id: string,
    name: string,
    screen_name: string,
    location: string,
    url: string,
    description: string,
    translator_type: string,
    protected: boolean,
    verified: boolean,
    followers_count: number,
    friends_count: number,
    listed_count: number,
    favourites_count: number,
    statuses_count: number,
    created_at: string,
    geo_enabled: boolean,
    lang: string,
    contributors_enabled: boolean,
    is_translator: boolean,
    profile_background_color: string,
    profile_background_image_url: string,
    profile_background_image_url_https: string,
    profile_background_tile: boolean,
    profile_link_color: string,
    profile_sidebar_border_color: string,
    profile_sidebar_fill_color: string,
    profile_text_color: string,
    profile_use_background_image: boolean,
    profile_image_url: string,
    profile_image_url_https: string,
    profile_banner_url: string,
    default_profile: boolean,
    default_profile_image: boolean
}

export interface DMMessage {
    id: string,
    text: string,
    user: TwitterUser,
    entities: Entities
}

export interface Tweet {
    created_at: string,
    id: string,
    text: string,
    source: string,
    truncated: boolean,
    in_reply_to_status_id: string,
    in_reply_to_user_id: string,
    in_reply_to_screen_name: string,
    user: TwitterUser,
    is_quote_status: boolean,
    quote_count: number,
    reply_count: number,
    retweet_count: number,
    favorite_count: number,
    entities: Entities,
    favorited: boolean,
    retweeted: boolean,
    filter_level: string,
    lang: string,
    timstamp_ms: string
}

export interface Entities {
    hashtags: string[],
    urls: string[],
    user_mentions: {
        screen_name: string,
        name: string,
        id: number,
        indices: number[]
    }[],
    symbols: string[]
}

export const mention = "@vitctipbot"
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

    walletConnection.on("sbp_rewards", async message => {
        const text = `Today's 💊 voter rewards were sent out this morning!

**${convert(message.vite, "RAW", "VITE")} ${tokenNameToDisplayName("VITE")}**!

And

**${convert(message.vitc, "RAW", "VITC")} ${tokenNameToDisplayName("VITC")}**!

Thanks to all our voters!`

        await twitc.v1.tweet(text)
    })

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
        if(sendingAddress){
            const [id, platform, sendingVariant] = sendingAddress.handles[0].split(".")
            switch(sendingVariant){
                case "Giveaway": 
                    text = `You won ${displayNumber} ${tokenNameToDisplayName(tokenName)} from a Giveaway!`+text
                break
                default: {
                    let mention = "Unknown User"
                    switch(platform){
                        case "Quota": {
                            //let's try to resolve the original id
                            if(!transaction.sender_handle)return
                            const id = transaction.sender_handle.split(".")[0]
                            const user = await fetchUser(id)
                            if(user)mention = "@"+user.username
                            break
                        }
                        case "Twitter": {
                            const user = await fetchUser(id)
                            if(!user)break
                            mention = "@"+user.username
                            break
                        }
                        case "Faucet":{
                            mention = "Faucet"
                        }
                    }text = `You were tipped ${displayNumber} ${tokenNameToDisplayName(tokenName)} by ${mention}!`+text
                }
            }
        }else{
            text = `${displayNumber} ${tokenNameToDisplayName(tokenName)} were deposited in your account's balance!`+text
        }
        for(const handle of address.handles){
            const [id, service] = handle.split(".")
            switch(service){
                case "Twitter": {
                    createDM(id, text).catch(()=>{})
                    break
                }
            }
        }
    })

    // normal tweets
	const stream = client.stream("statuses/filter", {track: mention.slice(1)})
    stream.on("data", async tweet => {
        // fucking bad library
        tweet.id = tweet.id_str
        delete tweet.id_str
        tweet.in_reply_to_status_id = tweet.in_reply_to_status_id_str
        delete tweet.in_reply_to_status_id_str
        tweet.user.id = tweet.user.id_str
        delete tweet.user.id_str

        let tempArgs = tweet.text.split(/ +/g)
        const mentionIndexs = []
        // eslint-disable-next-line no-constant-condition
        while(true){
            if(!tempArgs.length)break
            const mentionIndex = tempArgs.indexOf(mention)
            if(mentionIndex < 0)break
            tempArgs = tempArgs.slice(mentionIndex+1)
            mentionIndexs.push(mentionIndex)
        }
        
        // not mentionned.
        if(!mentionIndexs.length)return
        for(const mentionIndex of mentionIndexs){
            const args = tweet.text.split(/ +/g).slice(mentionIndex+1)
            const command = args.shift().toLowerCase()
            
            const cmd = commands.get(command)
            if(!cmd)continue
            if(!cmd.public)return
            const n = nonce++
    
            try{
                await cmd.executePublic(tweet, args, command)
            }catch(err){
                if(!(err instanceof Error) && "error" in err){
                    // eslint-disable-next-line no-ex-assign
                    err = JSON.stringify(err.error, null, "    ")
                }
                console.error(`${command} Twitter ${n}`, err)
                await replyTweet(
                    tweet.id,
                    `An unknown error occured. Please report that to devs (cc @NotThomiz): Execution ID ${n}`
                )
            }
        }
    })
	stream.on("error", error => {
        throw error
	})

    const webhook = new Autohook({
        consumer_key: process.env.TWITTER_API_KEY,
        consumer_secret: process.env.TWITTER_API_SECRET,
        token: process.env.TWITTER_ACCESS_TOKEN,
        token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        env: "production",
        port: 1765
    })
    await webhook.removeWebhooks()
    
    webhook.on("event", async msg => {
        // likely typing in dms, we don't care about those.
        if(!("direct_message_events" in msg))return
        for(const event of msg.direct_message_events){
            if(event.type !== "message_create")continue
            const user = msg.users[event.message_create.sender_id]
            if("@"+user.screen_name === mention)continue
            const message:DMMessage = {
                entities: event.message_create.message_data.entities,
                id: event.id,
                text: event.message_create.message_data.text,
                user: user
            } 
            if(!message.text.startsWith(".")){
                createDM(message.user.id, "Hey 👋, If you're wondering, my prefix is ., you can see a list of commands by doing .help")
                continue
            }
            const args = message.text.slice(1).trim().split(/ +/g)
            const command = args.shift().toLowerCase()

            const cmd = commands.get(command)
            if(!cmd?.dm)return

            const n = nonce++

            try{
                await cmd.executePrivate(message, args, command)
            }catch(err){
                if(!(err instanceof Error) && "error" in err){
                    // eslint-disable-next-line no-ex-assign
                    err = JSON.stringify(err.error, null, "    ")
                }
                console.error(`${command} Twitter ${n}`, err)
                await createDM(user.id, `An unknown error occured. Please report that to devs (cc @NotThomiz): Execution ID ${n}`)
            }
        }
    })

    await webhook.start()
  
    await webhook.subscribe({
        oauth_token: process.env.TWITTER_ACCESS_TOKEN,
        oauth_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    })
})