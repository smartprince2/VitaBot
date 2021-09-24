import events, { SBPMessageStats } from "../events";

export default async function sendSBPMessages(message:SBPMessageStats){
    // we don't directly send thoses here, 
    // we just broadcast them to twitter 
    // and discord bots.

    events.emit("sbp_message", message)

    return {}
}