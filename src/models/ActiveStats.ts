import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStats extends Document {
    user_id: string,
    message_id: string,
    createdAt: Date
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
        type: Date, 
        expires: 60*5
    }
})

export default mongoose.model<IActiveStats>("Active", ActiveSchema);