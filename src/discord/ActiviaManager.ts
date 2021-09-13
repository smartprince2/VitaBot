import { client } from "."
import { durationUnits } from "../common/util"
import ActiveStats from "../models/ActiveStats"
import ActiveStatus from "../models/ActiveStatus"
import ActiviaFreeze from "../models/ActiviaFreeze"
import activeQueue from "./activeQueue"
import { ALLOWED_RAINS_ROLES, VITC_ADMINS } from "./constants"

client.on("messageCreate", async message => {
    const content = message.content
    .replace(/<@!?\d+>|@(everyone|here)|<@&\d+>|<#\d+>|<a?:[\w\d_]+:\d+>/g, "")
    if(!content || content.length < 2)return
    if(
        !message.guild ||
        message.author.bot
    )return
    if(/^[?.!]\w+/.test(content))return

    let hasRole = false
    const member = await message.member.fetch().catch(() => null)
    if(!member)return
    for(const role of ALLOWED_RAINS_ROLES){
        if(!member.roles.cache.has(role))continue
        hasRole = true
        break
    }
    if(!hasRole)return

    await activeQueue.queueAction(message.author.id, async () => {
        const frozen = await ActiviaFreeze.findOne({
            user_id: message.author.id
        })
        if(frozen)return
        await ActiveStats.create({
            user_id: message.author.id,
            message_id: message.id,
            createdAt: new Date(),
            num: 1,
            guild_id: message.guildId
        })
        const numOfActives = await ActiveStats.countDocuments({
            user_id: message.author.id,
            createdAt: {
                $gt: new Date(Date.now()-durationUnits.m*5)
            },
            guild_id: message.guildId
        })
        if(numOfActives >= 5){
            const active = await ActiveStatus.findOne({
                user_id: message.author.id,
                guild_id: message.guildId
            })
            if(active){
                active.createdAt = new Date()
                await active.save()
            }else{
                await ActiveStatus.create({
                    user_id: message.author.id,
                    createdAt: new Date(),
                    guild_id: message.guildId
                })
            }
        }
    })
})
client.on("messageDelete", async message => {
    if(!message.content || message.content.length < 3)return
    if(
        !message.guildId
    )return

    await activeQueue.queueAction(message.author.id, async () => {
        const doc = await ActiveStats.findOne({
            message_id: message.id,
            guild_id: message.guildId
        })
        if(!doc)return
        await doc.delete()
        const numOfActives = await ActiveStats.countDocuments({
            user_id: message.author.id,
            guild_id: message.guildId
        })
        if(numOfActives < 5){
            const active = await ActiveStatus.findOne({
                user_id: message.author.id,
                guild_id: message.guildId
            })
            if(active){
                await active.delete()
            }
        }
    })
})

export async function getActiveUsers(guildId: string):Promise<string[]>{
    const users = await ActiveStatus.find({
        createdAt: {
            $gt: new Date(Date.now()-durationUnits.m*30)
        },
        guild_id: guildId
    })
    return users.map(e => e.user_id)
    .filter(e => !VITC_ADMINS.includes(e))
}