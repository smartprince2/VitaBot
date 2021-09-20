import { createDM, DMMessage, replyTweet, Tweet } from ".";
import { IAddress } from "../models/Address";
import * as twitterText from "twitter-text"

export async function isAddressOkayPublic(address:IAddress, tweet:Tweet):Promise<boolean>{
    if(!address.paused)return true
    await createDM("1433501349598072833", `An action was requested, but was blocked because account is frozen.
        
    @${tweet.user.screen_name} (${tweet.user.id}): ${tweet.text}`)
    await replyTweet(
        tweet.id,
        "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account."
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
    return twitterText.extractMentions(args.join(" "))
}