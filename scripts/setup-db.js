const inquirer = require("inquirer")
const {patch} = require("modernlog")
patch()
const dotenv = require("dotenv")
const { join } = require("path")
const mongoose = require("mongoose")
const vite = require("@vite/vitejs")
dotenv.config({
    path: join(__dirname, "../.env")
})
const Address = require("../dist/models/Address").default
const ActionQueue = require("../dist/common/queue").default

;(async () => {
    console.info("Setting up database... Connecting...")
    await mongoose.connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        auth: {
            password: process.env.MONGO_PASSWORD,
            user: process.env.MONGO_USER
        },
        authSource: "admin"
    })
    console.log("Connected!")
    const inquirerQueue = new ActionQueue()
    await Promise.all([
        (async () => {
            let botAddress = await Address.findOne({
                handles: "Batch.Quota"
            })
            if(!botAddress){
                await inquirerQueue.queueAction("", async()=>{
                    console.info("Creating batch quota address...")
                })
                const wallet = vite.wallet.createWallet()
                const addr = wallet.deriveAddress(0)
                botAddress = await Address.create({
                    network: "VITE",
                    seed: wallet.seedhex,
                    address: addr.address,
                    handles: [
                        "Batch.Quota"
                    ]
                })
                await inquirerQueue.queueAction("", async()=>{
                    console.log("Quota address created!")
                })
            }
            await inquirerQueue.queueAction("", async()=>{
                console.log("Please stake quota to \x1b[33m"+botAddress.address+"\x1b[37m")
            })
        })(),
    ])
    process.exit(0)
})()