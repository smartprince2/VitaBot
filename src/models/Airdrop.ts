import mongoose, { Document, Schema } from "mongoose";

export interface IAirdrop extends Document {
    date: Date,
    message_id: string,
    channel_id: string,
    guild_id: string,
    winners: number,
    user_id: string
}

const AirdropSchema = new Schema<IAirdrop>({
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
    user_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IAirdrop>("DiscordAirdrop", AirdropSchema);