import WebSocket from "ws"
import { VitaBotEventEmitter } from "../common/events"
import { ReceiveTransaction, SendTransaction } from "../wallet/events"

enum States {
    CLOSED = "CLOSED",
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
    CLOSING = "CLOSING"
}

export class WebsocketConnection extends VitaBotEventEmitter<{
    error: [Error],
    tx: [ReceiveTransaction|SendTransaction],
    open: [],
    close: []
}> {
    ws: WebSocket
    url = "ws://127.0.0.1:43430"
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
                resolve()
            }
            const errorEvent = (err) => {
                cleanEvents()
                this.ws = null
                this.emit("error", err)
                reject(err)

                setTimeout(() => {
                    this.connect().catch(()=>{})
                }, 2000)
            }
            ws.once("open", openEvent)
            ws.on("error", errorEvent)
        })
        // We are connected
        ws.on("close", () => {
            this.ws = null
            this.emit("close")

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
                this.ws.send(JSON.stringify({
                    op: "pong",
                    d: Date.now()
                }))
                break
            }
            case "tx": {
                this.emit("tx", data.d)
            }
        }
    }
}