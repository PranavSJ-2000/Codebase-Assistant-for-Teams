import { env } from "../config/env";
import { retryWithBackoff } from "../utils/retry";

export const EMBEDDING_MODEL = "all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

class EmbeddingServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EmbeddingServiceError";
    this.status = status;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof EmbeddingServiceError) return err.status >= 500;
  // fetch throws TypeError for network-level failures — also covers the
  // embedding-service container still being mid-startup (model loading).
  return err instanceof TypeError;
}

// Embeds all chunks of a file in a single call to the local embedding
// service — same batching rationale as the old OpenAI client had: one round
// trip per file instead of one per chunk.
export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  return retryWithBackoff(
    async () => {
      const res = await fetch(`${env.embeddingServiceUrl}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new EmbeddingServiceError(`Embedding service request failed (${res.status}): ${body}`, res.status);
      }

      const json = (await res.json()) as { embeddings: number[][] };
      return json.embeddings;
    },
    {
      attempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 8000,
      isRetryable,
      onRetry: (err, attempt, delayMs) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[embeddings] request failed (attempt ${attempt}), retrying in ${delayMs}ms: ${message}`);
      },
    }
  );
}
