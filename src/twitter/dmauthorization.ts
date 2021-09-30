import ActionQueue from "../common/queue";
import DMAuthorization from "../models/DMAuthorization";

const queue = new ActionQueue<string>()
const cache = new Map<string, boolean>()

export async function isAuthorized(user_id:string):Promise<boolean>{
    return queue.queueAction(user_id, async () => {
        if(cache.has(user_id))return cache.get(user_id)
        const auth = await DMAuthorization.findOne({
            user_id: user_id
        })
        cache.set(user_id, !!auth)
        return !!auth
    })
}

export async function setAuthorized(user_id:string){
    await queue.queueAction(user_id, async () => {
        if(cache.get(user_id))return
        const auth = await DMAuthorization.findOne({
            user_id
        })
        if(auth){
            cache.set(user_id, true)
            return
        }
        await DMAuthorization.create({
            user_id
        })
        cache.set(user_id, true)
        return
    })
}