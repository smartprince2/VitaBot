import { getVotes } from "../node";
import { SBPNameValidator } from "../types";

export default async function getSBPVotes(name:string){
    await SBPNameValidator.validateAsync(name)

    const votes = await getVotes(name)
    for(const address in votes.votes){
        if(votes.votes[address] == "0")delete votes.votes[address]
    }
    
    return votes
}