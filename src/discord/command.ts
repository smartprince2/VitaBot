/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message } from "discord.js"

export default class Command {
    description: string
    extended_description: string
    alias: string[]
    // Command usage where
    // <> is a mandatory argument
    // {} is an optional argument 
    usage: string
    hidden?: boolean

    async execute(message:Message, args:string[], command:string):Promise<void>{
        throw new CommandError("The command wasn't defined in its file.")
    }
}

export class CommandError extends Error {
    name = "CommandError"
}