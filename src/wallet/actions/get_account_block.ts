// Get an account block by hash

import { fetchAccountBlock } from "../node";
import { HashValidator } from "../types";

export default async function getAccountBlock(hash:string){
    await HashValidator.validateAsync(hash)

    const block = await fetchAccountBlock(hash)

    return block
}