import express from "express"
import http from "http"
import Joi from "joi"
import * as WebSocket from "ws"
import * as fs from "fs"
import { join } from "path"
import events from "./events"

console.log("Launching server")

const actions = new Map<string, (args:any[]) => Promise<any>>()

for(const file of fs.readdirSync(join(__dirname, "actions"))){
    const action = file.split(".")[0]
    actions.set(action, require(join(__dirname, "actions", file)).default)
}

const app = express()
.use((req, res, next) => {
    // only allow localhost to access this service.
    if(!["::ffff:127.0.0.1", "127.0.0.1"].includes(req.ip))return res.status(401).send({
        error: {
            name: "UnauthorizedError",
            message: "Your ip isn't allowed to access this service."
        }
    })
    next()
}).post(
    "/", 
    (req, res, next) => {
        const authorization = req.header("Authorization")
        if(authorization !== process.env.WALLET_API_KEY){
            res.status(401).send({
                error: {
                    name: "AuthenticationError",
                    message: "Invalid Authorization Header."
                }
            })
            return
        }
        next()
    },
    async (req, res, next) => {
        let data = ""
        req.setEncoding("utf8")
        req.on("data", chunk => { 
            data += chunk
        })
        req.on("end", () => {
            req.body = data
            next()
        })
    },
    async (req, res, next) => {
        try{
            const body = JSON.parse(req.body)
            req.body = await Joi.object({
                action: Joi.string().required().custom(action => {
                    if(!actions.has(action)){
                        throw new TypeError("Invalid Action.")
                    }
                    return action
                }),
                params: Joi.array().default([])
            }).required().validateAsync(body)
            next()
        }catch(err){
            res.status(400).send({
                error: {
                    name: err?.name||"ParsingError",
                    message: err?.message||"Couldn't parse the body of the request."
                }
            })
        }
    },
    async (req, res) => {
        const action = actions.get(req.body.action)
        try{
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const result = await action(...(req.body.params || []))
            res.status(200).send(result)
        }catch(err){
            console.error(err)
            res.status(500).send({
                error: {
                    name: err?.name || "Error",
                    message: err?.message || err ? JSON.stringify(err) : ""
                }
            })
        }
    }
).use((req, res) => {
    res.status(400).send({
        error: {
            name: "RoutingError",
            message: "Not Found"
        }
    })
})

const listenPort = parseInt(process.env.WALLET_PORT||"43430")
if(isNaN(listenPort)){
    throw new Error("Invalid port: "+process.env.WALLET_PORT)
}
const server = http.createServer(app)
.listen(listenPort, () => {
    console.log("Listening on http://[::1]:"+listenPort)
})


const wss = new WebSocket.Server({
    server
})

wss.on("connection", (ws, req) => {
    if(req.headers.authorization !== process.env.WALLET_API_KEY){
        ws.terminate()
        return
    }
    ws.send(JSON.stringify({
        op: "henlo",
        d: "e"
    }))
    const createPingTimeout = () => setTimeout(() => {
        ws.send(JSON.stringify({
            op: "ping",
            d: Date.now()
        }))
        pingTimeout = setTimeout(() => {
            ws.close(1000)
        }, 15*1000)
    }, 30*1000)
    let pingTimeout = createPingTimeout()
    ws.on("message", data => {
        try{
            const msg = JSON.parse(String(data))
            if(typeof msg !== "object" || !("op" in msg))return
            switch(msg.op){
                case "pong": {
                    clearTimeout(pingTimeout)
                    pingTimeout = createPingTimeout()
                }
            }
        }catch{}
    })

    const txlistener = tx => {
        ws.send(JSON.stringify({
            op: "tx",
            d: tx
        }))
    }
    events.on("receive_transaction", txlistener)
    events.on("send_transaction", txlistener)
    const sbpMessageListener = msg => {
        ws.send(JSON.stringify({
            op: "sbp_rewards",
            d: msg
        }))
    }
    events.on("sbp_message", sbpMessageListener)
    ws.on("close", () => {
        events.off("receive_transaction", txlistener)
        events.off("send_transaction", txlistener)
        events.off("sbp_message", sbpMessageListener)
    })
})