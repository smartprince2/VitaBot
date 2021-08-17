import mongoose, { Document, Schema } from "mongoose";

export interface ITip extends Document {
    amount: number,
    user_id: string,
    date: Date,
    txhash: string
}

const TipSchema = new Schema<ITip>({
    amount: {
        type: Number,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    txhash: {
        type: String,
        required: true
    }
})

export default mongoose.model<ITip>("Tip", TipSchema);