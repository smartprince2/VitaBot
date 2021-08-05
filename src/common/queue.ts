export default class ActionQueue<keyType = any> {
    actionQueues:Map<keyType, {
        processing: boolean,
        queue: (()=>Promise<void>)[]
    }> = new Map()

    async queueAction<T=void>(key:keyType, nextStep:()=>Promise<T>):Promise<T>{
        if(!this.actionQueues.has(key)){
            this.actionQueues.set(key, {
                processing: false,
                queue: []
            })
        }
        const acc = this.actionQueues.get(key)
        acc.queue.push(()=>nextStep().then(resolve, reject))
        let resolve:((value?:unknown)=>void)
        let reject:((error?:Error)=>void)
        return new Promise(async (r, j) => {
            resolve = r
            reject = j

            if(acc.processing)return
            acc.processing = true
            while(acc.queue[0]){
                const action = acc.queue.shift()
                await action()
            }
            this.actionQueues.delete(key)
        })
    }
}