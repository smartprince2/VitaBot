import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStats extends Document {
    user_id: string,
    message_id: string,
    createdAt: number
}

const ActiveSchema = new Schema<IActiveStats>({
    user_id: {
        type: String,
        required: true
    },
    message_id: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Number, 
        default: () => Date.now()
    }
})

export default mongoose.model<IActiveStats>("Active", ActiveSchema);