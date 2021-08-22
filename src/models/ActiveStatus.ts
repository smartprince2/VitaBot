import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStatus extends Document {
    user_id: string,
    createdAt: Date
}

const ActiveStatusSchema = new Schema<IActiveStatus>({
    user_id: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        expires: 60*30
    }
})

export default mongoose.model<IActiveStatus>("ActiveStatus", ActiveStatusSchema);