import fetch from "node-fetch"

export default new class PoWManager {
    async computeWork(hash:string, threshold:string):Promise<string>{
        try{
            const res = await fetch(process.env.POW_SERVER, {
                body: JSON.stringify({
                    action: "work_generate",
                    hash: hash,
                    threshold: threshold
                }),
                method: "post",
                timeout: 40000
            })
            const body = await res.json()
            if(!("work" in body))throw new Error("Invalid response from worker.")
            return body.work
        }catch(err){
            console.error(err)
            throw new Error("Couldn't compute PoW.")
        }
    }
}