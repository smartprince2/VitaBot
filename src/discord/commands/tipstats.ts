import BigNumber from "bignumber.js";
import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import Tip from "../../models/Tip";
import Command from "../command";

export default new class TipStatsCommand implements Command {
    description = "Your tipping stats"
    extended_description = `Display your tipping stats.

Examples:
**See statistics**
.tipstats`

    alias = ["tipstats"]
    usage = ""

    async execute(message:Message){
        const [
            numOfTips,
            total,
            biggest
        ] = await Promise.all([
            Tip.countDocuments({
                user_id: message.author.id
            }),
            Tip.aggregate([
                {
                    $match: {
                        user_id: message.author.id
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        amount: {
                            $sum: "$amount"
                        }
                    }
                }
            ]),
            Tip.find({
                user_id: message.author.id
            }).sort({amount: -1}).limit(1)
        ])
        
        let totalAmount = 0
        if(total[0]){
            totalAmount = Math.floor(total[0].amount*100)/100
        }
        let biggestAmount = 0
        if(biggest[0]){
            biggestAmount = Math.floor(biggest[0].amount*100)/100
        }
        
        const pair = tokenPrices[tokenIds.VITC+"/"+tokenIds.USDT]

        await message.reply(`You have sent **${numOfTips}** tips totalling **${
            totalAmount
        } ${tokenNameToDisplayName("VITC")}** (= **$${
            new BigNumber(pair?.closePrice || 0)
                .times(totalAmount)
                .toFixed(2, BigNumber.ROUND_DOWN)
        }**). Your biggest tip of all time is **${
            biggestAmount
        } ${tokenNameToDisplayName("VITC")}** (= **$${
            new BigNumber(pair?.closePrice || 0)
                .times(biggestAmount)
                .toFixed(2, BigNumber.ROUND_DOWN)
        }**)`)
    }
}