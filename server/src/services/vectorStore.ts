import { env } from "../config/env";
import { retryWithBackoff } from "../utils/retry";

export interface VectorMatch {
  id: number;
  score: number;
}

class VectorServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VectorServiceError";
    this.status = status;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof VectorServiceError) return err.status >= 500;
  return err instanceof TypeError;
}

export async function searchVectors(namespace: string, vector: number[], topK: number): Promise<VectorMatch[]> {
  return retryWithBackoff(
    async () => {
      const res = await fetch(`${env.vectorServiceUrl}/vectors/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace, vector, topK }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new VectorServiceError(`Vector service search failed (${res.status}): ${body}`, res.status);
      }

      const json = (await res.json()) as { matches: VectorMatch[] };
      return json.matches;
    },
    { attempts: 3, baseDelayMs: 500, maxDelayMs: 5000, isRetryable }
  );
}
