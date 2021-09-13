import "../common/load-env"
import { dbPromise } from "../common/load-db"
import Twit from "twit"
import Twitter from "twitter"
import Command from "./command"
import {promises as fs} from "fs"
import {join} from "path"

export const clientv2 = new Twit({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})
export const clientv1 = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

export const commands = new Map<string, Command>()
export const rawCommands = [] as Command[]

export function replyTweet(reply_to: string, text: string){
    return new Promise<Tweet>((resolve, reject) => {
        clientv1.post("statuses/update", {
            status: text,
            in_reply_to_status_id: reply_to
        }, (error, data: any) => {
            if(error){
                reject(error)
            }else{
                resolve(data)
            }
        })
    })
}

// Broken typing on this because this payload won't work with normal Twitter, and needs twitc
export async function createDM(recipient_id: string, text: string):Promise<any>{
    return clientv2.v1.sendDm({
        recipient_id: recipient_id,
        text: text
    })
}

export interface TwitterUser {
    id: number,
    id_str: string,
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

export interface Tweet {
    created_at: string,
    id: number,
    id_str: string,
    text: string,
    source: string,
    truncated: boolean,
    in_reply_to_status_id: number,
    in_reply_to_status_id_str: string,
    in_reply_to_user_id: number,
    in_reply_to_user_id_str: string,
    in_reply_to_screen_name: string,
    user: TwitterUser,
    is_quote_status: boolean,
    quote_count: number,
    reply_count: number,
    retweet_count: number,
    favorite_count: number,
    entities: {
        hashtags: string[],
        urls: string[],
        user_mentions: {
            screen_name: string,
            name: string,
            id: number,
            id_str: number,
            indices: number[]
        }[],
        symbols: string[]
    },
    favorited: boolean,
    retweeted: boolean,
    filter_level: string,
    lang: string,
    timstamp_ms: string
}

const mention = "@jen_wina"
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

	const stream = clientv1.stream("statuses/filter", {track: mention.slice(1)})
    stream.on("data", async tweet => {
        let args = tweet.text.split(/ +/g)
        const mentionIndex = args.indexOf(mention)
        // not mentionned.
        if(mentionIndex < 0)return
        args = args.slice(mentionIndex+1)
        const command = args.shift().toLowerCase()
        
        const cmd = commands.get(command)
        if(!cmd?.public)return
        const n = nonce++

        try{
            await cmd.execute(tweet, args, command)
        }catch(err){
            console.error(`${command} Twitter ${n}`, err)
            if(!(err instanceof Error) && "error" in err){
                // eslint-disable-next-line no-ex-assign
                err = JSON.stringify(err.error, null, "    ")
            }
            await replyTweet(
                tweet.id_str,
                `An unknown error occured. Please report that to devs (cc @NotThomiz): Execution ID ${n}`
            )
        }
    })
	stream.on("error", error => {
        throw error
	})
})