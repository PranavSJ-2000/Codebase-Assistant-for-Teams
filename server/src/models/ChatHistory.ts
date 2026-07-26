import { Schema, model } from "mongoose";

const retrievedChunkSchema = new Schema(
  {
    filePath: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const chatHistorySchema = new Schema(
  {
    repoId: { type: Schema.Types.ObjectId, required: true, ref: "Repo", index: true },
    // No auth system yet — caller supplies userId directly for now.
    userId: { type: String, required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    retrievedChunks: { type: [retrievedChunkSchema], default: [] },
  },
  { timestamps: true }
);

export const ChatHistory = model("ChatHistory", chatHistorySchema);
