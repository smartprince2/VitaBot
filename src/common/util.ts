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