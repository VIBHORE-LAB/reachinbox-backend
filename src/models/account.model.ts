import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ObjectId } from "mongodb";

export interface IAccount extends Document {
    _id: ObjectId;
  host: string;
  port: number;
  user: string;
  password: string;
  demo?: boolean;
  owner: Types.ObjectId; 
  createdAt: Date;
}

const AccountSchema: Schema<IAccount> = new Schema({
  host: { type: String, default: "imap.gmail.com" },
  port: { type: Number, default: 993 },
  user: { type: String, required: true },
  password: { type: String, required: true },
  demo: { type: Boolean, default: false },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

const AccountModel: Model<IAccount> = mongoose.model<IAccount>(
  "Account",
  AccountSchema
);

export default AccountModel;
