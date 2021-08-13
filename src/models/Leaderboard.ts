import mongoose, { Document, Schema } from "mongoose";
import { Networks } from "../common/constants";

export interface ILeaderboard extends Document {
    network: Networks
    address: string,
    amount: {
        [token: string]: number
    }
}

const LeaderboardSchema = new Schema<ILeaderboard>({
    network: {
        type: String,
        required: true
    },
    address: {
        required: true,
        unique: true,
        type: String
    },
    amount: {
        type: Object,
        required: true
    }
})

export default mongoose.model<ILeaderboard>("Leaderboard", LeaderboardSchema);