import mongoose, { Document, Schema } from "mongoose";

export interface IGiveaway extends Document {
    date: Date,
    message_id: string,
    channel_id: string,
    guild_id: string,
    winners: number,
    total_amount: string,
    token_id: string,
    user_id: string,
    currency: string
}

const GiveawaySchema = new Schema<IGiveaway>({
    date: {
        required: true,
        type: Date
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
    winners: {
        type: Number,
        required: true
    },
    total_amount: {
        type: String,
        required: true
    },
    token_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    currency: {
        type: String,
        required: true
    }
})

export default mongoose.model<IGiveaway>("DiscordGiveaway", GiveawaySchema);