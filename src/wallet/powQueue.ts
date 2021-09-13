import { wait } from "../common/util"

const powWaitingList = new Map<string, Promise<void>>()

export async function waitPoW(address: string){
    const waitpromise = powWaitingList.get(address)
    if(waitpromise)await waitpromise
}

export function PoWDone(address:string){
    return
    powWaitingList.set(address, wait(10000).then(() => {
        powWaitingList.delete(address)
    }))
}