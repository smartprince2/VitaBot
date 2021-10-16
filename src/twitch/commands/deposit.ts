import { ChatUserstate } from "tmi.js";
import { client } from "..";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import twitchqueue from "../twitchqueue";
import * as qrcode from "qrcode"
import { uploadImage } from "../../common/image_upload";
import { PassThrough } from "stream";

export default new class TestCommand extends Command {
    public = false
    dm = true
    description = "Get your deposit address"
    extended_description = `Get your deposit address`
    alias = ["deposit"]
    usage = ""

    async executePrivate?(channel:string, tags:ChatUserstate):Promise<void>{
        await this.sendDepositAddress(tags["user-id"], tags.username)
    }
    async sendDepositAddress(user_id:string, username:string){
        const address = await twitchqueue.queueAction(user_id, async () => {
            return getVITEAddressOrCreateOne(user_id, "Twitter")
        })
        const data = `vite:${address.address}`
        const stream = new PassThrough()
        let url = "Error: Couldn't upload the image"
        qrcode.toFileStream(stream, data, (error) => {
            if(error)throw error
        })
        await Promise.all([
            (async () => {
                try{
                    url = await uploadImage(stream)
                }catch(err){
                    console.error(err)
                }
            })()
        ])
        console.log(url)
        await client.whisper(username, `Here's your deposit address:`)
        await client.whisper(username, address.address)
        await client.whisper(username, `Here's also a qrcode for scanning the address: ${url}`)
    }
}