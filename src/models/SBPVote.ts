import mongoose, { Document, Schema } from "mongoose";

export interface ISBPVote extends Document {
    since: Date,
    address: string
}

const SBPVoteSchema = new Schema<ISBPVote>({
    since: {
        type: Date,
        required: true
    },
    address: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<ISBPVote>("SBPVote", SBPVoteSchema);