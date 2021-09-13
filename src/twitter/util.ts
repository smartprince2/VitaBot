import { replyTweet } from ".";
import { IAddress } from "../models/Address";

export async function checkAddressPaused(address:IAddress, id:string):Promise<boolean>{
    if(!address.paused)return true
    await replyTweet(
        id,
        "Your account has been frozen, likely for using "+
        "alts or abusing a faucet/rains. "+
        "Please contact @NotThomiz to unlock your account."
    )
    return false
}