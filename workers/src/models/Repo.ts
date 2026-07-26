import { Schema, model } from "mongoose";

// Mirrors server/src/models/Repo.ts — same collection, two processes.
// If these drift, ingestion (server) and embedding (workers) will disagree
// about what the status/progress fields mean; keep them in sync by hand
// until this becomes a shared package.
export const REPO_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type RepoStatus = (typeof REPO_STATUSES)[number];

const repoSchema = new Schema(
  {
    githubUrl: { type: String, required: true, trim: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: REPO_STATUSES,
      default: "pending",
      required: true,
    },
    totalFiles: { type: Number, default: 0 },
    totalChunks: { type: Number, default: 0 },
    processedFiles: { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

export const Repo = model("Repo", repoSchema);
