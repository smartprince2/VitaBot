// Get balance by address

import viteQueue from "../viteQueue";
import { getBalances } from "../node";
import { AddressValidator } from "../types";

export default async function getAccountBalances(address:string){
    await AddressValidator.validateAsync(address)

    const balances = await viteQueue.queueAction(address, () => getBalances(address))

    return balances
}