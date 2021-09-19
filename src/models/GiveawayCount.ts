import mongoose, { Document, Schema } from "mongoose";

export interface IGiveawayCount extends Document {
    count: number,
    guild_id: string
}

// TODO: Implement a correct giveaway count, instead of messages ids.
// https://i.imgur.com/NMHOEkF.png

const GiveawayCountSchema = new Schema<IGiveawayCount>({
    count: {
        type: Number,
        required: true
    },
    guild_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IGiveawayCount>("DiscordGiveawayCount", GiveawayCountSchema);