// Get all votes for an sbp

import { getVotes } from "../node";
import { SBPNameValidator } from "../types";
import { getCurrentCycle } from "../cycle";
import Joi from "joi";

export default async function getSBPVotes(name:string, cycle:number = getCurrentCycle()){
    await SBPNameValidator.validateAsync(name)
    await Joi.number().required().max(getCurrentCycle()).min(0).validateAsync(cycle)

    const votes = await getVotes(name, cycle)
    for(const address in votes.votes){
        if(votes.votes[address] == "0")delete votes.votes[address]
    }
    
    return votes
}