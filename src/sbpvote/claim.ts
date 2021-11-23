// Script to automatically claim sbp rewards.

import "../common/load-env"
import * as vite from "@vite/vitejs"
import { Platform, tokenIds, tokenTickers } from "../common/constants"
import { convert } from "../common/convert"
import { dbPromise } from "../common/load-db"
import viteQueue from "../cryptocurrencies/viteQueue"
import { requestWallet } from "../libwallet/http"
import { WebsocketConnection } from "../libwallet/ws"
import { IAddress } from "../models/Address"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import BigNumber from "bignumber.js"
import lt from "long-timeout"

const destinations = [
    {
        percent: 45,
        // voters distribution
        address: "SBP.Rewards"
    },
    {
        percent: 25,
        // mods distribution
        address: "Mods.Rewards"
    },
    {
        percent: 30,
        // vitc treasury
        address: "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac"
    }
]
const sbp = process.env.SBP_NAME

const ws = new WebsocketConnection()

Promise.all([
    dbPromise,
    ws.connect()
]).then(async () => {
    let totalPercent = 0
    let sbpClaimAddress:IAddress
    const promises = [
        (async()=>{
            sbpClaimAddress = await getVITEAddressOrCreateOne("SBPClaim", "Rewards")
        })()
    ]
    for(const destination of destinations){
        if(destination.percent <= 0)throw new Error("Invalid percent")
        totalPercent += destination.percent
        if(!vite.wallet.isValidAddress(destination.address)){
            promises.push((async ()=>{
                const parts = destination.address.split(".")
                const address = await getVITEAddressOrCreateOne(parts[0], parts.slice(1).join(".") as Platform)
                destination.address = address.address
            })())
        }
    }
    if(totalPercent !== 100){
        console.error("The total percent distribution plan isn't equal to 100%")
        process.exit()
    }
    await Promise.all(promises)

    ws.on("tx", async tx => {
        if(tx.to !== sbpClaimAddress.address || tx.type !== "receive")return
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", tokenTickers[tx.token_id])} ${tokenTickers[tx.token_id]}`)
        if(tx.token_id !== tokenIds.VITE)return

        await viteQueue.queueAction(sbpClaimAddress.address, async () => {
            const balances = await requestWallet("get_balances", sbpClaimAddress.address)
            const viteBalance = new BigNumber(balances[tokenIds.VITE])
            // wait to have at least 400 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the claim address
            if(viteBalance.isLessThan(convert("400", "VITE", "RAW")))return

            // math time
            const payouts = []
            for(const destination of destinations){
                const amount = viteBalance.times(destination.percent).div(100)
                if(amount.isEqualTo(0))continue
                payouts.push([
                    destination.address,
                    amount.toFixed(0)
                ])
            }
            // math time finished :(
            const start = Date.now()

            await requestWallet("bulk_send", sbpClaimAddress.address, payouts, tokenIds.VITE)
            
            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
        })
    })

    // check rewards and withdraw functions
    const checkRewards = async () => {
        const rewards = await requestWallet("get_sbp_rewards_pending_withdrawal", sbp)
        if(rewards.totalReward === "0")return
        console.log("Withdrawing rewards...")

        await requestWallet(
            "withdraw_sbp_rewards", 
            sbpClaimAddress.address, 
            sbpClaimAddress.address, 
            sbp
        )
    }
    await checkRewards()
    // every 30 minutes
    lt.setInterval(checkRewards, 30*60*1000)
})