// get pending SBP Rewards by sbp

import { getSBPRewardsPendingWithdrawal } from "../node";
import { SBPNameValidator } from "../types";

export default async function getSBPRewardsPendingWithdrawalAction(sbp: string){
    await SBPNameValidator.validateAsync(sbp)

    const rewards = await getSBPRewardsPendingWithdrawal(sbp)

    return rewards
}