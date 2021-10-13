import "../common/load-env"
import "../common/load-db"
import { dbPromise } from "../common/load-db"
import { durationUnits } from "../common/util"
import lt from "long-timeout"
import { join } from "path"
import {promises as fs} from "fs"
import mongoose from "mongoose"

dbPromise.then(() => {
    console.log("Starting backup service")
    const interval = durationUnits.d
    const dateInterval = new Date(interval)
    console.log(`Will backup every ${dateInterval.getDate()-1}d ${dateInterval.getHours()}:${dateInterval.getMinutes()}:${dateInterval.getSeconds()}`)

    const newLoop = () => {
        const now = Date.now()
        const nextDay = now-(now%interval)+interval
        
        console.log(`Backup scheduled at`, new Date(nextDay))

        lt.setTimeout(() => {
            backup(nextDay)
            newLoop()
        }, nextDay-now)
    }
    newLoop()
})

async function backup(timestamp){
    const date = new Date(timestamp)
    console.log(`Backing up`, date)

    const backupFolder = join(__dirname, "../../backups", `${date.toISOString()}`)

    await fs.mkdir(backupFolder, {recursive: true})

    const collections = await mongoose.connection.db.listCollections().toArray()

    await Promise.all(collections.map(async collection => {
        const documents = await mongoose.connection.db.collection(collection.name).find({}).toArray()

        const data = "[\n    "+documents.map(e => JSON.stringify(e)).join(",\n    ")+"\n]"
        await fs.writeFile(join(backupFolder, collection.name+".json"), data)
    }))

    console.log(`Finished backing up`)
}