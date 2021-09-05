import express from "express"
import http from "http"
import * as ws from "ws"

const app = express()
.post(
    "/", 
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
            const body = req.body = JSON.parse(req.body)
            if(
                typeof body !== "object" || 
                !body
            )throw new Error("Invalid Body: must be object.")
            next()
        }catch(err){
            res.status(400).send({
                error: {
                    name: "ParsingError",
                    message: err.message
                }
            })
        }
    }
)

const listenPort = parseInt(process.env.WALLET_PORT||"42420")
if(isNaN(listenPort)){
    throw new Error("Invalid port: "+process.env.WALLET_PORT)
}
const server = http.createServer(app)
.listen(listenPort)


const wss = new ws.Server({
    server
})