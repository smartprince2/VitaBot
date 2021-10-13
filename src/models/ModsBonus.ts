import mongoose, { Document, Schema } from "mongoose";

export interface IModsBonus extends Document {
    id: string,
    platform: "Discord",
    reason: string
}

const ModsBonusSchema = new Schema<IModsBonus>({
    reason: {
        required: true,
        type: String
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

export default mongoose.model<IModsBonus>("ModsBonus", ModsBonusSchema);