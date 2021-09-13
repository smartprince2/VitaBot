import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStatus extends Document {
    user_id: string,
    createdAt: Date,
    guild_id: string
}

const ActiveStatusSchema = new Schema<IActiveStatus>({
    user_id: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        expires: 60*30
    },
    guild_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IActiveStatus>("ActiveStatus", ActiveStatusSchema);