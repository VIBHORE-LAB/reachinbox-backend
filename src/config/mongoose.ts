import mongoose from "mongoose";
import { log } from "../utils/logger";

export async function connectMongoose() {
  const URI = process.env.MONGO_URI;
  if (!URI) throw new Error("MONGO_URI is not defined in .env");

  try {
    await mongoose.connect(URI, {
      dbName: "ReachInbox",
    });
    log("Connected to MongoDB via Mongoose");
  } catch (err) {
    log("Mongoose connection error:", err);
    throw err;
  }
}
