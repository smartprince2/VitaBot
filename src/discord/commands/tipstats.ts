import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { client } from "..";
import rain from "./rain";
import { randomFromArray } from "../../common/util";

export default new class Tipstats implements Command {
    description = "Stats of the bot"
    extended_description = `Display VitaBot's statistics.

Examples:
**See statistics**
.tipstats`

    alias = ["tipstats"]
    usage = ""

    async execute(message:Message, args: string[], command: string){
        
    }
}