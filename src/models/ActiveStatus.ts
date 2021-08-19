import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStatus extends Document {
    user_id: string,
    createdAt: number
}

const ActiveStatusSchema = new Schema<IActiveStatus>({
    user_id: {
        type: String,
        required: true
    },
    createdAt: {
        type: Number,
        default: () => Date.now()
    }
})

export default mongoose.model<IActiveStatus>("ActiveStatus", ActiveStatusSchema);