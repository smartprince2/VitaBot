export async function retryAsync<T=void>(func:(tries?:number)=>Promise<T>, triesLeft:number, total?:number):Promise<T>{
    total = total || triesLeft
    try{
        return func(total - triesLeft)
    }catch(err){
        if(triesLeft === 1)throw err
        return retryAsync(func, triesLeft-1, total)
    }
}

export function randomFromArray<result extends any>(array: result[]):result{
    return array[array.length * Math.random() | 0] 
}

export function wait(ms:number):Promise<void>{
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}

export class DurationError extends Error {
    name = "DurationError"
}
export const durationUnits = {
    s: 1000,
    m: 60*1000,
    h: 60*60*1000,
    d: 24*60*60*1000,
    w: 7*24*60*60*1000
}
export function resolveDuration(durationstr:string){
    if(!durationstr.length)return
    let duration = 0n
    let input = ""
    const chars = durationstr.split("")
    
    while(chars[0]){
        const unit = chars.shift()
        if(/^\d+(m|s|h|d|w)$/.test(input+unit)){
            const multiplier = BigInt(durationUnits[unit])
            const rawDuration = BigInt(input)
            duration = duration + rawDuration*multiplier
            input = ""
        }else{
            input += unit
        }
    }
    if(input)throw new DurationError("Invalid duration: "+durationstr)
    return duration
}

let nonce = 0
const timeouts = new Map<number, ()=>void>()
export function setLongTimeout(callback:()=>void, ms: number){
    const id = nonce++
    if(ms <= durationUnits.d){
        const timeout = setTimeout(() => {
            timeouts.delete(id)
            callback()
        }, ms)
        timeouts.set(id, () => {
            clearTimeout(timeout)
        })
    }else{
        let remaining = ms
        const start = Date.now()
        const interval = setInterval(() => {
            remaining = remaining-(Date.now()-start)
            if(remaining <= durationUnits.d){
                // that means it lasts less than a day
                clearInterval(interval)
                const timeout = setTimeout(() => {
                    timeouts.delete(id)
                    callback()
                }, remaining)
                timeouts.set(id, () => {
                    clearTimeout(timeout)
                })
            }
        }, durationUnits.d)
        timeouts.set(id, () => {
            clearInterval(interval)
        })
    }
    return id
}
export function clearLongTimeout(handle:number){
    const clear = timeouts.get(handle)
    if(!clear)return
    clear()
    timeouts.delete(handle)
}