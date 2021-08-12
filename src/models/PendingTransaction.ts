import mongoose, { Document, Schema } from "mongoose";
import { Networks } from "../common/constants";
import { IAddress } from "./Address";

export interface IPendingTransactions extends Document {
    network: Networks
    address: IAddress,
    toAddress: string,
    handle: string,
    amount: string,
    tokenId: string
}

const AddressSchema = new Schema<IPendingTransactions>({
    network: {
        type: String,
        required: true
    },
    address: {
        required: true,
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Address"
    },
    toAddress: {
        type: String,
        required: true
    },
    handle: {
        required: true,
        type: String
    },
    amount: {
        type: String,
        required: true
    },
    tokenId: {
        type: String,
        required: true
    }
})

export default mongoose.model<IPendingTransactions>("PendingTransaction", AddressSchema);