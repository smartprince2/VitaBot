import { patch } from "modernlog"
patch()
import dotenv from "dotenv"
import path from "path"
import BigNumber from "bignumber.js"
BigNumber.config({
    ROUNDING_MODE: BigNumber.ROUND_DOWN
})

dotenv.config({
    path: path.join(__dirname, "../../.env")
})

process.on("unhandledRejection", console.error)
process.on("uncaughtException", console.error)