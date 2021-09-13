import { Tweet } from "..";
import { getVITEAddressOrCreateOne } from "../../cryptocurrencies/vite";
import Command from "../command";
import twitterqueue from "../twitterqueue";

export default new class Balance implements Command {
    public = true
    dm = true
    description = "Get your deposit address"
    extended_description = `get your deposit address`
    alias = ["deposit"]
    usage = ""

    async execute(data:Tweet){
        const address = await twitterqueue.queueAction(data.user.id_str, async () => {
            return getVITEAddressOrCreateOne(data.user.id_str, "Twitter")
        })
        if(address.paused){
            
            return
        }
    }
}