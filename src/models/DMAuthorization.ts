import mongoose, { Document, Schema } from "mongoose";

export interface IDMAuthorization extends Document {
    user_id: string
}

const DMAuthorizationSchema = new Schema<IDMAuthorization>({
    user_id: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IDMAuthorization>("DMAuthorization", DMAuthorizationSchema);