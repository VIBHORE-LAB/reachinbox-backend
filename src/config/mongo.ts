// src/config/mongo.ts
import { MongoClient, Db } from "mongodb";
import { log } from "../utils/logger";

let db: Db;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  const URI = process.env.MONGO_URI;
  if (!URI) throw new Error("MONGO_URI is not defined");

  const client = new MongoClient(URI, { serverApi: { version: "1" } });

  try {
    await client.connect();
    log(" Connected to MongoDB via native MongoClient");

    db = client.db("ReachInbox");
    return db;
  } catch (err) {
    log("MongoClient connection error:", err);
    throw err;
  }
}
