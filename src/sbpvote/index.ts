// Script to distribute rewards.

import "../common/load-env"
import { requestWallet } from "../libwallet/http";
import BigNumber from "bignumber.js"
import { WebsocketConnection } from "../libwallet/ws";

const ws = new WebsocketConnection()
ws.connect()
.then(() => {
    console.log("Connected")
    ws.on("tx", console.log)
})

/*
requestWallet("get_sbp_votes", "VitaminCoinSBP")
.then((votes:{
    name: string,
    total: string,
    votes: {
        [address: string]: string
    }
}) => {
    const addresses = {}
    const total = new BigNumber(votes.total)
    const viteTotal = new BigNumber(695).shiftedBy(18)
    for(const address in votes.votes){
        const viteAmount = new BigNumber(new BigNumber(votes.votes[address])
            .div(total)
            .times(viteTotal)
            .toString()
            .split(".")[0])
            .shiftedBy(-18)
            .toFixed()
        addresses[address] = viteAmount
    }
    console.log(JSON.stringify(addresses, null, 4))
    let totalVite = 0
    for(const address in addresses){
        const amount = parseFloat(addresses[address])
        totalVite = totalVite+amount
    }
    console.log(JSON.stringify(totalVite, null, 4))
})
*/