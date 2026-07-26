import { Schema, model } from "mongoose";

// Mirrors workers/src/models/Chunk.ts — same collection, two processes.
// Keep both copies in sync by hand until this becomes a shared package.
const chunkSchema = new Schema(
  {
    vectorId: { type: Number, required: true, unique: true },
    repoId: { type: Schema.Types.ObjectId, required: true, ref: "Repo", index: true },
    filePath: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    symbol: { type: String },
    language: { type: String, required: true },
    embeddingModel: { type: String, required: true },
  },
  { timestamps: true }
);

chunkSchema.index({ repoId: 1, filePath: 1, chunkIndex: 1 }, { unique: true });

export const Chunk = model("Chunk", chunkSchema);
