const CYCLE_EPOCH = new Date("2019-05-21T12:00:00+08:00").getTime()

export function getCurrentCycle(){
    return getCycle(Date.now())
}

export function getCycle(time:number){
    const elapsedTime = time-CYCLE_EPOCH
    const days = Math.floor(elapsedTime/24/60/60/1000)
    return days
}

export function getDateFromCycle(cycle:number):Date{
    const elapsedTime = cycle*24*60*60*1000
    return new Date(CYCLE_EPOCH+elapsedTime)
}