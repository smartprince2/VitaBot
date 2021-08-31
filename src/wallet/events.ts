import { VitaBotEventEmitter } from "../common/events";

export interface Transaction {
    type: "send"|"receive",
    from: string,
    to: string,
    hash: string
}

export interface SendTransaction extends Transaction {
    type: "send"
}


export interface ReceiveTransaction extends Transaction {
    type: "send"
}

export default new VitaBotEventEmitter<{
    send_transaction: [SendTransaction],
    receive_transaction: [ReceiveTransaction]
}>()