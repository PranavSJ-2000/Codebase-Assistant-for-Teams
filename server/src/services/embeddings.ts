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
  return err instanceof TypeError;
}

export async function embedText(text: string): Promise<number[]> {
  return retryWithBackoff(
    async () => {
      const res = await fetch(`${env.embeddingServiceUrl}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [text] }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new EmbeddingServiceError(`Embedding service request failed (${res.status}): ${body}`, res.status);
      }

      const json = (await res.json()) as { embeddings: number[][] };
      return json.embeddings[0];
    },
    { attempts: 4, baseDelayMs: 500, maxDelayMs: 8000, isRetryable }
  );
}
