import { patch } from "modernlog"
patch()
import dotenv from "dotenv"
import path from "path"

dotenv.config({
    path: path.join(__dirname, "../../.env")
})

process.on("unhandledRejection", console.error)
process.on("uncaughtException", console.error)