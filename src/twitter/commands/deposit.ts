import { DMMessage, replyTweet, twitc } from "..";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import twitterqueue from "../twitterqueue";
import * as qrcode from "qrcode"
import { TweetV1 } from "twitter-api-v2";

export default new class DepositCommand implements Command {
    public = true
    dm = true
    description = "Get your deposit address"
    extended_description = `Get your deposit address`
    alias = ["deposit"]
    usage = ""

    async executePublic(data:TweetV1){
        await this.sendDepositAddress(data.user.id_str)
        await replyTweet(data.id_str, "I've sent your deposit address in your DM!")
    }

    async executePrivate(message:DMMessage){
        await this.sendDepositAddress(message.user.id)
    }

    async sendDepositAddress(user_id:string){
        const address = await twitterqueue.queueAction(user_id, async () => {
            return getVITEAddressOrCreateOne(user_id, "Twitter")
        })
        const data = `vite:${address.address}`
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            qrcode.toBuffer(data, (error, buffer) => {
                if(error)return reject(error)
                resolve(buffer)
            })
        })

        const mediaId = await twitc.v1.uploadMedia(buffer, {
            type: "png",
            target: "dm"
        })
        await twitc.v1.sendDm({
            recipient_id: user_id,
            text: address.address,
            attachment: {
                type: "media",
                media: {
                    id: mediaId
                }
            }
        })
    }
}