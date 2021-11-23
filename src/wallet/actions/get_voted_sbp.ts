// Get the sbp an address is voting for

import { getVotedSBP } from "../node";
import { AddressValidator } from "../types";

export default async function getSBPVotes(address:string){
    await AddressValidator.validateAsync(address)

    const sbp = await getVotedSBP(address)
    return sbp || null
}