import { createDM, Tweet } from "..";
import Command from "../command";

export default new class Balance implements Command {
    public = true
    dm = true
    description = "Display your balance"
    extended_description = `Display your current balance`
    alias = ["balance", "bal"]
    usage = ""

    async execute(data:Tweet, args:string[], command:string){
        console.log(data)
        await createDM(data.user.id_str, "henlo")
    }
}