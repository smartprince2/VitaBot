import { MessageEmbed } from "discord.js";
import { client } from ".";
import { VITC_COLOR } from "../common/constants";

export function generateDefaultEmbed(){
    return new MessageEmbed()
    .setColor(VITC_COLOR)
    .setFooter(client.user?.username || "VitaBot", client.user?.avatarURL({
        dynamic: true
    }))
}

const USER_PATTERN = /^<@!?(?<id>\d{17,19})>$/;
const ID_PATTERN = /^\d{17,19}$/
export function isDiscordUserArgument(arg: string){
    return USER_PATTERN.test(arg) || ID_PATTERN.test(arg)
}
export async function parseDiscordUser(arg: string){
    if(USER_PATTERN.test(arg)){
        const parsed = arg.match(USER_PATTERN)
        const user = await client.users.fetch(parsed.groups.id)
        return user
    }else if(ID_PATTERN.test(arg)){
        const user = await client.users.fetch(arg)
        return user
    }
    return null
}