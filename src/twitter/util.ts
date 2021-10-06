import { createDM, DMMessage, twitc } from ".";
import { IAddress } from "../models/Address";
import * as twitterText from "twitter-text"
import { TweetV1 } from "twitter-api-v2";

export async function isAddressOkayPublic(address:IAddress, tweet:TweetV1):Promise<boolean>{
    if(!address.paused)return true
    await createDM("1433501349598072833", `An action was requested, but was blocked because account is frozen.
        
    @${tweet.user.screen_name} (${tweet.user.id}): ${tweet.text}`)
    await twitc.v1.reply(
        "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account.",
        tweet.id_str
    )
    return false
}
export async function isAddressOkayPrivate(address:IAddress, message:DMMessage):Promise<boolean>{
    if(!address.paused)return true
    await createDM("1433501349598072833", `An action was requested, but was blocked because account is frozen.
        
    @${message.user.screen_name} (${message.user.id}): ${message.text}`)
    await createDM(
        message.user.id,
        "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account."
    )
    return false
}
export function extractMention(args:string[]){
    const mentions = []
    for(const arg of args){
        const mention = twitterText.extractMentions(arg.split("\n")[0])
        if(!mention[0])break
        mentions.push(mention[0])
        if(arg.includes("\n"))break
    }
    return mentions
}