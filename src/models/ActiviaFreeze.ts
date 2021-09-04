import mongoose, { Document, Schema } from "mongoose";

export interface IActiviaFreeze extends Document {
    user_id: string
}

const ActiveStatusSchema = new Schema<IActiviaFreeze>({
    user_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IActiviaFreeze>("ActiveFreeze", ActiveStatusSchema);