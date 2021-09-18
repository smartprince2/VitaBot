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
const BotSettings = require("../dist/models/BotSettings").default
const ActionQueue = require("../dist/common/queue").default
const { Client, Team } = require("discord.js")

;(async () => {
    console.info("Setting up database... Connecting and logging on Discord...")
    const client = new Client({
        intents: []
    })
    client.token = process.env.DISCORD_TOKEN
    await Promise.all([
        mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            auth: {
                password: process.env.MONGO_PASSWORD,
                user: process.env.MONGO_USER
            },
            authSource: "admin"
        }),
        client.login()
    ])
    console.log("Connected!")
    const inquirerQueue = new ActionQueue()
    await Promise.all([
        (async () => {
            let botAddress = await Address.findOne({
                handles: "Batch.Quota"
            })
            if(!botAddress){
                await inquirerQueue.queueAction("", async () => {
                    console.info("Creating batch quota address...")
                })
                const wallet = vite.wallet.createWallet()
                const addr = wallet.deriveAddress(0)
                botAddress = await Address.create({
                    network: "VITE",
                    seed: wallet.seedHex,
                    address: addr.address,
                    handles: [
                        "Batch.Quota"
                    ]
                })
                await inquirerQueue.queueAction("", async () => {
                    console.log("Quota address created!")
                })
            }
            await inquirerQueue.queueAction("", async () => {
                console.log("Please stake quota to \x1b[33m"+botAddress.address+"\x1b[37m")
            })
        })(),
        (async () => {
            let SBPRewardsAddress = await Address.findOne({
                handles: "SBP.Rewards"
            })
            if(!SBPRewardsAddress){
                await inquirerQueue.queueAction("", async () => {
                    console.info("Creating SBP Rewards address...")
                })
                const wallet = vite.wallet.createWallet()
                const addr = wallet.deriveAddress(0)
                SBPRewardsAddress = await Address.create({
                    network: "VITE",
                    seed: wallet.seedHex,
                    address: addr.address,
                    handles: [
                        "SBP.Rewards"
                    ]
                })
                await inquirerQueue.queueAction("", async () => {
                    console.warn("Please Save this mnemonic phrase somewhere safe: \x1b[33m"+wallet.mnemonics+"\x1b[37m")
                })
                await inquirerQueue.queueAction("", async () => {
                    console.log("SBP Rewards created!")
                })
            }
            await inquirerQueue.queueAction("", async () => {
                console.log("Please use this address to claim SBP rewards: \x1b[33m"+SBPRewardsAddress.address+"\x1b[37m")
            })
        })(),
        (async () => {
            let ownerSetting = await BotSettings.findOne({
                name: "BOT_OWNER"
            })
            if(!ownerSetting){
                const application = await client.application.fetch()
                let user_id
                if(application.owner instanceof Team){
                    user_id = application.owner.ownerId
                }else{
                    user_id = application.owner.id
                }
                ownerSetting = await BotSettings.create({
                    name: "BOT_OWNER",
                    value: user_id
                })
            }
            try{
                const user = await client.users.fetch(ownerSetting.value)
                await inquirerQueue.queueAction("", async()=>{
                    console.log(`Bot's owner is ${user.tag} (${user.id})`)
                })
            }catch(err){
                console.error(err)
                await inquirerQueue.queueAction("", async()=>{
                    console.log("Bot's owner is "+ownerSetting.value)
                })
            }
        })()
    ])
    process.exit(0)
})()