import mongoose, { Document, Schema } from "mongoose";

export interface IBotSettings extends Document {
    name: string,
    value: string
}

const BotSettingsSchema = new Schema<IBotSettings>({
    name: {
        type: String,
        unique: true,
        required: true
    },
    value: {
        type: String,
        required: true
    }
})

export default mongoose.model<IBotSettings>("BotSettings", BotSettingsSchema);