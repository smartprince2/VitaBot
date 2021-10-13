import mongoose, { Document, Schema } from "mongoose";

export interface IPersonalAddress extends Document {
    address: string,
    id: string,
    platform: "Discord"
}

const PersonalAddressSchema = new Schema<IPersonalAddress>({
    address: {
        required: true,
        type: String,
        unique: true
    },
    id: {
        required: true,
        type: String,
        unique: true
    },
    platform: {
        type: String,
        required: true
    }
})

export default mongoose.model<IPersonalAddress>("PersonalAddress", PersonalAddressSchema);