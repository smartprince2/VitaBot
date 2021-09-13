import WS_RPC from "vitejs-notthomiz-ws";
import {ViteAPI} from "vitejs-notthomiz";
import { onNewAccountBlock } from "./receive";

export const availableNodes = [
    ...new Set([
        process.env.VITE_WS,
        "wss://vitanode.lightcord.org/ws",
        "wss://node-tokyo.vite.net/ws"
    ])
]

export let wsProvider
let lastNode

export function getLastUsedNode(){
    return lastNode
}

export async function init(){
    lastNode = availableNodes[0]
    console.info("[VITE] Connecting to "+availableNodes[0])
    // TODO: DO our own library, because vitejs isn't good.
    const wsService = new WS_RPC(availableNodes[0], 6e5, {
        protocol: "",
        headers: "",
        clientConfig: "",
        retryTimes: Infinity,
        retryInterval: 10000
    })
    await new Promise((resolve) => {
        wsProvider = new ViteAPI(wsService, resolve)
    })
    console.log("[VITE] Connected to node")
    await registerEvents()
}

async function registerEvents(){
    await Promise.all([
        wsProvider.subscribe("createAccountBlockSubscription")
        .then(AccountBlockEvent => {
            AccountBlockEvent.on(async (result) => {
                try{
                    await onNewAccountBlock(result[0].hash)
                }catch(err){
                    console.error(err)
                }
            })
        })
    ])
}