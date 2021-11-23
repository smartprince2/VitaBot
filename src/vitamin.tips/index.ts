import "../common/load-env"
import express from "express"
import { dbPromise } from "../common/load-db"

export const app = express()

dbPromise.then(() => {
    app.listen(3060, () => {
        console.log("Listening on http://127.0.0.1:3060")
    })
})