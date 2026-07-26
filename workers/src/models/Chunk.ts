import { Schema, model } from "mongoose";

// One document per embedded chunk. `vectorId` is the numeric id used as the
// FAISS row id — this collection is the lookup from "vector matched at
// query time" back to the actual code + location.
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
