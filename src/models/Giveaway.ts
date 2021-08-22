import mongoose, { Document, Schema } from "mongoose";

export interface IGiveaway extends Document {
    duration: number,
    creation_date: Date,
    bot_message_id?: string,
    message_id: string,
    channel_id: string,
    guild_id: string,
    user_id: string
}

const GiveawaySchema = new Schema<IGiveaway>({
    duration: {
        type: Number,
        required: true
    },
    creation_date: {
        required: true,
        type: Date
    },
    bot_message_id: {
        type: String
    },
    message_id: {
        type: String,
        required: true,
        unique: true
    },
    channel_id: {
        type: String,
        required: true
    },
    guild_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IGiveaway>("DiscordGiveaway", GiveawaySchema);