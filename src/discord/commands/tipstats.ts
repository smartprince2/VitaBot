import { Message } from "discord.js";
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
        await message.reply(`You have sent **${numOfTips}** tips totalling **${totalAmount} VITC**. Your biggest tip of all time is **${biggestAmount} VITC**`)
    }
}