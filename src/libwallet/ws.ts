import WebSocket from "ws"
import { VitaBotEventEmitter } from "../common/events"
import { ReceiveTransaction, SBPMessageStats, SendTransaction } from "../wallet/events"

enum States {
    CLOSED = "CLOSED",
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
    CLOSING = "CLOSING"
}

export class WebsocketConnection extends VitaBotEventEmitter<{
    error: [Error],
    tx: [ReceiveTransaction|SendTransaction],
    sbp_rewards: [SBPMessageStats]
    open: [],
    close: []
}> {
    ws: WebSocket
    url = "ws://127.0.0.1:43430"
    pingTimeout: NodeJS.Timeout
    async connect(){
        if(![WebsocketConnection.States.CLOSING, WebsocketConnection.States.CLOSED].includes(this.state))return // Already connected
        const ws = this.ws = new WebSocket(this.url, {
            headers: {
                Authorization: process.env.WALLET_API_KEY
            }
        })
        ws.on("message", message => {
            const data = JSON.parse(message.toString("utf8"))
            this.onMessage(data)
        })
        await new Promise<void>((resolve, reject) => {
            const cleanEvents = () => {
                ws.off("open", openEvent)
            }
            const openEvent = () => {
                cleanEvents()
                this.emit("open")
                this.resetPingTimeout()
                resolve()
            }
            const errorEvent = (err) => {
                cleanEvents()
                this.ws = null
                this.emit("error", err)
                clearTimeout(this.pingTimeout)

                setTimeout(() => {
                    this.connect().catch(()=>{})
                }, 2000)
                reject(err)
            }
            ws.once("open", openEvent)
            ws.on("error", errorEvent)
        })
        // We are connected
        ws.on("close", () => {
            this.ws = null
            this.emit("close")
            clearTimeout(this.pingTimeout)

            setTimeout(() => {
                this.connect().catch(()=>{})
            }, 2000)
        })
    }
    get state(){
        if(!this.ws || this.ws.readyState === 3)return WebsocketConnection.States.CLOSED
        return [
            WebsocketConnection.States.CONNECTING,
            WebsocketConnection.States.CONNECTED,
            WebsocketConnection.States.CLOSING
        ][this.ws.readyState]
    }
    static States = States

    onMessage(data:any){
        switch(data.op){
            case "ping": {
                this.resetPingTimeout()
                this.ws.send(JSON.stringify({
                    op: "pong",
                    d: Date.now()
                }))
                break
            }
            case "tx": {
                this.emit("tx", data.d)
                break
            }
            case "sbp_rewards": {
                this.emit("sbp_rewards", data.d)
                break
            }
            case "henlo":
                console.log("[WS]: Henlo")
        }
    }

    resetPingTimeout(){
        clearTimeout(this.pingTimeout)
        this.pingTimeout = setTimeout(() => {
            console.log("[WS]: Ping Timeout. Closing connection and reopening.")
            this.ws.terminate()
            this.connect().catch(console.error)
        }, 45000)
    }
}