import { Queue } from "bullmq";
import type { EmbedFileJobData } from "../types/ingestion";
import { redisConnection } from "./connection";

export const EMBED_REPO_QUEUE = "embed-repo";

export const embedRepoQueue = new Queue<EmbedFileJobData>(EMBED_REPO_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});
