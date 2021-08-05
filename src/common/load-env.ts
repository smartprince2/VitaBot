import { patch } from "modernlog"
patch()
import dotenv from "dotenv"
import path from "path"

dotenv.config({
    path: path.join(__dirname, "../../.env")
})