import "../common/load-env"
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import * as vite from "@vite/vitejs"
import Address from "../models/Address"

dbPromise.then(async () => {
    const address = process.argv[2]
    if(!vite.wallet.isValidAddress(address)){
        console.error("The specified address is invalid.")
        process.exit(1)
    }

    const blocks = []
    let shouldFetch = true
    const max = 100
    while(shouldFetch){
        const transactions = await requestWallet(
            "get_account_blocks",
            address,
            blocks[blocks.length-1]?.hash || null,
            null,//"tti_22d0b205bed4d268a05dfc3c",
            max
        )
        if(transactions.length < max){
            shouldFetch = false
        }
        if(blocks.length){
            transactions.shift()
        }
        blocks.push(...transactions)
    }
    
    const checked = new Set<string>()
    const validAddresses = []
    for(const block of blocks){
        let peerAddress = "vite_0000000000000000000000000000000000000000a4f3a0cb58"
        if(block.fromAddress !== address){
            peerAddress = block.fromAddress
        }else{
            peerAddress = block.toAddress
        }
        if(checked.has(peerAddress))continue
        checked.add(peerAddress)
        if(!vite.wallet.isValidAddress(peerAddress))continue
        console.log("Checking "+peerAddress)
        const addr = await Address.findOne({
            address: peerAddress
        })
        if(addr)continue
        validAddresses.push(peerAddress)
    }
    console.log([...checked], validAddresses)
})