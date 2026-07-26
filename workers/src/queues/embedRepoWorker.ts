import { Job, Worker } from "bullmq";
import { Types } from "mongoose";
import { redisConnection } from "../connection";
import { Chunk } from "../models/Chunk";
import { Repo } from "../models/Repo";
import { EMBEDDING_MODEL, embedChunks } from "../services/embeddings";
import { upsertVectors } from "../services/vectorStore";
import type { EmbedFileJobData } from "../types/ingestion";
import { computeVectorId } from "../utils/vectorId";

export const EMBED_REPO_QUEUE = "embed-repo";

async function processEmbedRepoJob(job: Job<EmbedFileJobData>): Promise<void> {
  const { repoId, filePath, language, chunks } = job.data;
  if (chunks.length === 0) return;

  // One call to the local embedding service for every chunk in this file
  // (see services/embeddings.ts); retry/backoff for transient failures
  // happens inside embedChunks.
  const vectors = await embedChunks(chunks.map((c) => c.content));

  const vectorRecords = chunks.map((chunk, i) => ({
    id: computeVectorId(repoId, filePath, chunk.index),
    vector: vectors[i],
  }));

  // Store in FAISS first — if this throws, the job retries and nothing has
  // been recorded in Mongo yet, so there's no dangling metadata. Namespaced
  // by repoId so a search against one repo never surfaces another repo's
  // chunks.
  await upsertVectors(repoId, vectorRecords);

  const repoObjectId = new Types.ObjectId(repoId);

  await Chunk.bulkWrite(
    chunks.map((chunk, i) => ({
      updateOne: {
        filter: { repoId: repoObjectId, filePath, chunkIndex: chunk.index },
        update: {
          $set: {
            vectorId: vectorRecords[i].id,
            repoId: repoObjectId,
            filePath,
            chunkIndex: chunk.index,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            symbol: chunk.symbol,
            language,
            embeddingModel: EMBEDDING_MODEL,
          },
        },
        upsert: true,
      },
    }))
  );

  const updated = await Repo.findByIdAndUpdate(
    repoId,
    { $inc: { processedFiles: 1, processedChunks: chunks.length } },
    { new: true }
  );

  if (updated && updated.status !== "ready" && updated.processedFiles >= updated.totalFiles) {
    await Repo.findByIdAndUpdate(repoId, { status: "ready" });
  }
}

export function createEmbedRepoWorker(): Worker<EmbedFileJobData> {
  const worker = new Worker<EmbedFileJobData>(EMBED_REPO_QUEUE, processEmbedRepoJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("failed", async (job, err) => {
    console.error(`[embed-repo] Job ${job?.id} (${job?.data.filePath}) failed:`, err);

    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // will be retried by BullMQ

    // Retries exhausted — surface this instead of leaving the repo stuck
    // at "processing" forever with no explanation.
    await Repo.findByIdAndUpdate(job.data.repoId, {
      status: "failed",
      error: `Failed to embed ${job.data.filePath}: ${err.message}`,
    }).catch((updateErr) => {
      console.error(`[embed-repo] Failed to mark repo ${job.data.repoId} as failed:`, updateErr);
    });
  });

  return worker;
}
