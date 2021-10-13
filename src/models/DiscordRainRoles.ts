import mongoose, { Document, Schema } from "mongoose";

export interface IRainRoles extends Document {
    guild_id: string,
    role_id: string
}

const RainRoles = new Schema<IRainRoles>({
    guild_id: {
        type: String,
        required: true
    },
    role_id: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IRainRoles>("RainRoles", RainRoles);