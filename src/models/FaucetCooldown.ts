import mongoose, { Document, Schema } from "mongoose";

export interface IFaucetCooldown extends Document {
    user_id: string,
    date: Date
}

const FaucetCooldownSchema = new Schema<IFaucetCooldown>({
    user_id: String,
    date: Date
})

export default mongoose.model<IFaucetCooldown>("FaucetCooldown", FaucetCooldownSchema);