// Withdraw SBP Rewards for given SBP.

import Address from "../../models/Address";
import { AddressValidator, SBPNameValidator, WalletAddressValidator } from "../types";
import viteQueue from "../viteQueue";
import * as vite from "@vite/vitejs"
import { tokenIds } from "../node";
import { send } from "../send";

export default async function withdrawSBPRewardsAction(fromAddress: string, toAddress: string, sbp: string){
    await WalletAddressValidator.validateAsync(fromAddress)
    await AddressValidator.validateAsync(toAddress)
    await SBPNameValidator.validateAsync(sbp)
    
    const address = await Address.findOne({
        address: fromAddress
    })

    if(!address)throw new Error("from address not found.")

    const tx = await viteQueue.queueAction(fromAddress, async () => {
        const call = vite.abi.encodeFunctionCall(
            vite.constant.Contracts.WithdrawSBPReward.abi,
            [
                sbp,
                toAddress
            ]
        )

        return send(
            address, 
            vite.constant.Contracts.WithdrawSBPReward.contractAddress, 
            "0", 
            tokenIds.VITE, 
            Buffer.from(call, "hex").toString("base64")
        )
    })

    return tx
}