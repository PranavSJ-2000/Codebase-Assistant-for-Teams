import mongoose from "mongoose";
import { env } from "./config/env";

export async function connectToDatabase(): Promise<void> {
  if (!env.mongoUri) {
    console.warn("[db] MONGO_URI is not set — skipping MongoDB connection.");
    return;
  }

  await mongoose.connect(env.mongoUri);
  console.log("[db] Connected to MongoDB");
}
