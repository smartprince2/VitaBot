import Address, { IAddress } from "../models/Address"
import { changeSBP, getVotedSBP, sendTX, tokenIds, wsProvider } from "./node"
import * as vite from "vitejs-notthomiz"
import viteQueue from "./viteQueue"
import events from "./events"
import { CONSENSUS_ABI } from "./abis"
import ActionQueue from "../common/queue"
import SBPVote from "../models/SBPVote"

const skipBlocks = new Set()

export async function onNewAccountBlock(hash: string){
    if(skipBlocks.has(hash))return
    skipBlocks.add(hash)
    try{
        await (async () => {
            const block = await wsProvider.request("ledger_getAccountBlockByHash", hash)
            if(!block)return
            if(![2,3,6].includes(block.blockType))return
            switch(block.toAddress){
                case CONSENSUS_CONTRACT_ADDRESS: {
                    await onConsensusContractTransaction(block)
                    break
                }
                default: {
                    if(skipReceiveBlocks.has(block.hash))return
                    // Don't even try to check for smart contracts
                    if(vite.wallet.isValidAddress(block.toAddress) === vite.wallet.AddressType.Contract)return
                    const address = await Address.findOne({
                        address: block.toAddress,
                        network: "VITE"
                    })
                    if(!address || skipReceiveBlocks.has(block.hash))return
                    skipReceiveBlocks.add(block.hash)
                    await receive(block, address)
                    setTimeout(() => {
                        skipReceiveBlocks.delete(block.hash)
                    }, 25000)
                }
            }
        })()
    }catch(err){
        skipBlocks.delete(hash)
        throw err
    }
    skipBlocks.delete(hash)
}
const consensusQueue = new ActionQueue<string>()
const CONSENSUS_CONTRACT_ADDRESS = "vite_0000000000000000000000000000000000000004d28108e76b"
export async function onConsensusContractTransaction(block: any){
    try{
        const hexData = Buffer.from(block.data, "base64").toString("hex")
        const id = hexData.slice(0, 8)
        const abi_json = CONSENSUS_ABI.find(m => m.id === id)
        if(!abi_json || !["VoteForSBP", "Vote", "CancelVote", "CancelSBPVoting"].includes(abi_json.name))return
        // call to the consensus contract vote for.
        const params = hexData.slice(8)
        const decoded = vite.abi.decodeParameters(abi_json, params)
    
        let name = ""
        switch(abi_json.name){
            case "VoteForSBP":
                if(decoded.length !== 1 || !vite.utils.isValidSBPName(decoded[0]))return
                name = decoded[0]
            break
            case "Vote":
                if(decoded.length !== 2 || !decoded[1] || !vite.utils.isValidSBPName(decoded[1]))return
                name = decoded[1]
            break
        }
        const vitcSBPName = process.env.SBP_NAME
        // check if entry in database
        await consensusQueue.queueAction(block.fromAddress, async () => {
            const oldSBP = await SBPVote.findOne({
                address: block.fromAddress
            })
            if(!oldSBP && vitcSBPName !== name)return
            if(!oldSBP && vitcSBPName === name){
                // new voter
                await SBPVote.create({
                    since: new Date(),
                    address: block.fromAddress
                })
            }else if(oldSBP && vitcSBPName !== name){
                // old voter
                await oldSBP.delete()
            }else{
                oldSBP.since = new Date()
                await oldSBP.save()
            }
        })
    }catch{
        // do nothing if we can't parse.
    }
}

const skipSBPCheck = new Set<string>()
export const skipReceiveBlocks = new Set<string>()
export async function receive(block: any, address: IAddress){
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    const hash = await viteQueue.queueAction(address.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("receive", {
            address: address.address,
            sendBlockHash: block.hash
        })
        accountBlock.setPrivateKey(keyPair.privateKey)
        return sendTX(address.address, accountBlock)
    })
    
    if(block.tokenInfo.tokenId === tokenIds.VITE && !skipSBPCheck.has(address.address)){
        skipSBPCheck.add(address.address)
        viteQueue.queueAction(address.address, async () => {
            // lmao vote for Vitamin Coin SBP
            const sbp = await getVotedSBP(address.address)
            if(sbp?.blockProducerName !== process.env.SBP_NAME){
                await changeSBP(address, process.env.SBP_NAME)
            }
        })
    }

    events.emit("receive_transaction", {
        type: "receive",
        from: block.fromAddress,
        to: block.toAddress,
        hash: hash,
        from_hash: block.hash,
        amount: block.amount,
        token_id: block.tokenInfo.tokenId
    })
    return hash
}
