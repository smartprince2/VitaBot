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