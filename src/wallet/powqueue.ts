const powLimit = Infinity

let count = 0

const queue = []

export async function waitPow(callback:()=>Promise<void>){
    if(count === powLimit){
        await new Promise((resolve, reject) => {
            queue.push({
                resolve,
                reject,
                callback
            })
        })
    }else{
        count++
        const error = []
        try{
            await callback()
        }catch(err){
            error.push(err)
        }
        count--
        if(queue.length > 0){
            const elem = queue.shift()
            waitPow(elem.callback)
            .then(elem.resolve, elem.reject)
        }
        if(error.length > 0)throw error[0]
        return
    }
}