import { Message } from "discord.js";
import { durationUnits } from "../../common/util";
import ActiveStats from "../../models/ActiveStats";
import ActiveStatus from "../../models/ActiveStatus";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed } from "../util";

export default new class ActiveCommand implements Command {
    description = "Get a list of users activia"
    extended_description = `See a list of users that have sent a message in the last 5 minutes, or that have the active status.`
    alias = ["active"]
    usage = ""
    hidden = true

    async execute(message:Message){
        if(!VITC_ADMINS.includes(message.author.id))return

        const [
            lastMessages,
            activia,
            activeMessages
        ] = await Promise.all([
            ActiveStats.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gt: new Date(Date.now()-durationUnits.m*30)
                        }
                    }
                },
                {
                    $group: {
                        _id: "$user_id", 
                        createdAt: {
                            $max: "$createdAt"
                        }
                    }
                }
            ]),
            ActiveStatus.find({
                createdAt: {
                    $gt: new Date(Date.now()-durationUnits.m*30)
                }
            }),
            ActiveStats.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gt: new Date(Date.now()-durationUnits.m*5)
                        }
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        messageCount: {
                            $sum: "$num"
                        }
                    }
                }
            ])
        ])

        const messageCountForUser = (user:{_id:string}) => {
            return activeMessages.find(e => e._id === user._id)?.messageCount || 0
        }

        const list = lastMessages.sort((a, b) => {
            return messageCountForUser(b)-messageCountForUser(a)
        }).map(user => {
            const isActive = !!activia.find(e => e.user_id === user._id)
            return `${
                isActive ? "**" : ""
            }<@${user._id}>:${
                messageCountForUser(user)
            } msg/5min. ${
                ""
            }Last msg: <t:${Math.floor(user.createdAt.getTime()/1000)}:R>${
                isActive ? "**" : ""
            }`
        })
        const embed = generateDefaultEmbed()
        .setTitle(`${activia.length} Active Members`)
        .setDescription(list.join("\n"))
        await message.reply({
            embeds: [embed]
        })
    }
}