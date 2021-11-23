import "../common/load-env"
import BigNumber from "bignumber.js";
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import { getVITEAddressOrCreateOne } from "../wallet/address";
import * as vite from "@vite/vitejs"
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";

const data = ``.split(/[\n\r]+/g)
const amount = new BigNumber(convert("1500", "VITC", "RAW"))
if(data.length === 0){
    console.error("Please add the list of addresses to send to.")
    process.exit(1)
}
dbPromise.then(async () => {
    console.log("Sending from Thomiz's account")
    const account = await getVITEAddressOrCreateOne("696481194443014174", "Discord")

    const validAddress = []
    for(const addr of data){
        if(!vite.wallet.isValidAddress(addr)){
            console.error(`${addr} isn't a valid vite address.`)
            continue
        }
        validAddress.push(addr)
    }
    if(validAddress.length === 0){
        console.error("No valid addresses were found. Aborting.")
        process.exit(1)
    }
    const total = amount.times(validAddress.length)
    const balances = await requestWallet("get_balances", account.address)
    const balance = new BigNumber(balances[tokenIds.VITC] || 0)
    if(balance.isLessThan(total)){
        console.error("Not enough balance. Needs "+convert(total, "RAW", "VITC")+" VITC.")
        process.exit(1)
    }

    console.log(`Sending ${convert(amount, "RAW", "VITC")} VITC to ${validAddress.length} addresses`)

    await requestWallet(
        "bulk_send",
        account.address,
        validAddress.map(a => {
            return [
                a,
                amount.toFixed(0)
            ]
        }),
        tokenIds.VITC
    )

    console.log("Sent amount!")
    process.exit()
})