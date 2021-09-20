import { createDM, DMMessage, replyTweet, Tweet } from "..";
import { tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import twitterqueue from "../twitterqueue";

export default new class BalanceCommand implements Command {
    public = true
    dm = true
    description = "Display your balance"
    extended_description = `Display your current balance`
    alias = ["balance", "bal"]
    usage = ""

    async executePublic(tweet:Tweet){
        await this.sendBalanceToUser(tweet.user.id)
        await replyTweet(tweet.id, "I've sent your balance in your DM!")
    }

    async executePrivate(message:DMMessage){
        await this.sendBalanceToUser(message.user.id)
    }

    async sendBalanceToUser(user_id: string){
        const address = await twitterqueue.queueAction(user_id, async () => {
            return getVITEAddressOrCreateOne(user_id, "Twitter")
        })

        const balances = await viteQueue.queueAction(address.address, async () => {
            return requestWallet("get_balances", address.address)
        })

        if(!balances[tokenIds.VITC])balances[tokenIds.VITC] = "0"

        await createDM(user_id, `Your current balance:
        
${Object.keys(balances).map(tokenId => {
    const displayToken = tokenTickers[tokenId] || tokenId
    const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

    return `${tokenNameToDisplayName(displayToken)}: ${displayBalance}`
}).join("\n")}

View on vitescan: https://vitescan.io/address/${address.address}`)
    }
}