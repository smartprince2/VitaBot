import { DMMessage, twitc } from ".";
import { IAddress } from "../models/Address";
import * as twitterText from "twitter-text"
import { TweetV2 } from "twitter-api-v2";

export async function isAddressOkayPublic(address:IAddress, tweet:TweetV2):Promise<boolean>{
    if(!address.paused)return true
    await twitc.v1.sendDm({
        recipient_id: "1433501349598072833",
        text: `An action was requested, but blocked because account is frozen.
        
${tweet.author_id}: ${tweet.text}`
    })
    await twitc.v1.reply(
        "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account.",
        tweet.id
    )
    return false
}
export async function isAddressOkayPrivate(address:IAddress, message:DMMessage):Promise<boolean>{
    if(!address.paused)return true
    await twitc.v1.sendDm({
        recipient_id: "1433501349598072833",
        text: `An action was requested, but blocked because account is frozen.
        
@${message.user.screen_name} (${message.user.id}): ${message.text}`
    })
    await twitc.v1.sendDm({
        recipient_id: message.user.id,
        text: "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account."
    })
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