import mongoose, { Document, Schema } from "mongoose";
import { Networks } from "../common/constants";

export interface IAddress extends Document {
    network: Networks
    seed: string,
    address: string,
    handles: string[],
    paused: boolean
}

const AddressSchema = new Schema<IAddress>({
    network: {
        type: String,
        required: true
    },
    seed: {
        required: true,
        unique: true,
        type: String
    },
    address: {
        required: true,
        unique: true,
        type: String
    },
    handles: [
        {
            required: true,
            unique: true,
            type: String
        }
    ],
    paused: Boolean
})

export default mongoose.model<IAddress>("Address", AddressSchema);