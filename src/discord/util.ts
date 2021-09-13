import { MessageEmbed, Message, TextChannel } from "discord.js";
import { client } from ".";
import { VITC_COLOR } from "../common/constants";

export function generateDefaultEmbed(){
    return new MessageEmbed()
    .setColor(VITC_COLOR)
    .setFooter(client.user?.username || "VitaBot", client.user?.avatarURL({
        dynamic: true
    }))
}

const USER_PATTERN = /^<@!?(?<id>\d{17,19})>$/
const ID_PATTERN = /^\d{17,19}$/
const ROLE_PATTERN = /^<@&?(?<id>\d{17,19})>$/
export function isDiscordUserArgument(arg: string){
    return USER_PATTERN.test(arg) || ID_PATTERN.test(arg) || ROLE_PATTERN.test(arg)
}
export async function parseDiscordUser(arg: string){
    if(USER_PATTERN.test(arg)){
        const parsed = arg.match(USER_PATTERN)
        try{
            const user = await client.users.fetch(parsed.groups.id)
            return [user]
        }catch{
            return []
        }
    }else if(ID_PATTERN.test(arg)){
        try{
            const user = await client.users.fetch(arg)
            return [user]
        }catch{
            return []
        }
    }else if(ROLE_PATTERN.test(arg)){
        const parsed = arg.match(ROLE_PATTERN)
        try{
            const guild = client.guilds.cache.find(e => e.roles.cache.has(parsed.groups.id))
            if(!guild)return []
            const members = await guild.members.fetch()
            return members.filter(e => 
                e.roles.cache.has(parsed.groups.id) && 
                !e.user.bot
            ).map(e => e.user)
        }catch{
            return []
        }
    }
    return []
}
export async function throwFrozenAccountError(message:Message, args: string[], command: string){
    await (client.guilds.cache.get("862416292760649768").channels.cache.get("872114540857401374") as TextChannel).send(
        `An action was requested, but was blocked because account is frozen.
        
<@${message.author.id}> (${message.author.tag}): ${command} ${JSON.stringify(args)}`
    )
    throw new Error("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact an admin to unlock your account.")
}