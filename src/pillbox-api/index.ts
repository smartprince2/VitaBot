import "../common/load-env"
import express from "express"
import { createServer } from "http"
import WebSocket from "ws"
import { dbPromise } from "../common/load-db"
import { walletConnection } from "../cryptocurrencies/vite"
import Joi from "joi"

export const app = express()
.disable("x-powered-by")

export const server = createServer(app)

export type WSExtended = {
    state: {
        subscribed_addresses: string[],
        subscribed_prices: string[],
    }
}
export const wss = new WebSocket.Server({
    server
})
wss.on("connection", (ws:WebSocket&WSExtended) => {
    ws.state = {
        subscribed_addresses: [],
        subscribed_prices: []
    }
    ws.on("message", async message => {
        let msg
        try{
            msg = JSON.parse(message.toString("utf-8"))
            await Joi.object({
                op: Joi.string().required().allow("subscribe_address"),
                d: Joi.string().required()
            }).required().validateAsync(msg)
        }catch{
            ws.close(1000)
            return
        }
    })
})

dbPromise.then(async () => {
    server.listen(3130)

    walletConnection.on("tx", (tx) => {
        for(const client of wss.clients as Set<WebSocket&WSExtended>){

        }
    })
})