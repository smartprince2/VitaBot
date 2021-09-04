import mongoose, { Document, Schema } from "mongoose";

export interface IGiveawayEntry extends Document {
    message_id: string,
    user_id: string,
    date: Date,
    txhash: string
}

const GiveawayEntrySchema = new Schema<IGiveawayEntry>({
    message_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    txhash: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IGiveawayEntry>("DiscordGiveawayEntry", GiveawayEntrySchema);