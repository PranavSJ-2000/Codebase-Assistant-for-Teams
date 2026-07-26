import mongoose from "mongoose";
import { env } from "./env";

export async function connectToDatabase(): Promise<void> {
  if (!env.mongoUri) {
    console.warn("[db] MONGO_URI is not set — skipping MongoDB connection.");
    return;
  }

  try {
    await mongoose.connect(env.mongoUri);
    console.log("[db] Connected to MongoDB");
  } catch (err) {
    console.error("[db] Failed to connect to MongoDB:", err);
  }
}
