import { Schema, model, type InferSchemaType } from "mongoose";

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
    // Known once chunking finishes; embedding progress is tracked against these.
    totalFiles: { type: Number, default: 0 },
    totalChunks: { type: Number, default: 0 },
    processedFiles: { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

export type RepoDocument = InferSchemaType<typeof repoSchema>;

export const Repo = model("Repo", repoSchema);
