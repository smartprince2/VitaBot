import { clientv1, Tweet } from "..";
import Command from "../command";

export default new class Test implements Command {
    public = true
    dm = true
    description = "Test the bot"
    extended_description = `See if the bot is available`
    alias = ["test"]
    usage = ""

    async execute(data:Tweet){
        console.log(data)
        await clientv1.post("statuses/update", {
            status: `Hello, everything works !`,
            in_reply_to_status_id: data.id
        })
    }
}