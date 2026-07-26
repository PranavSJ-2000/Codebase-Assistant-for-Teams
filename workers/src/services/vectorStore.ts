import { env } from "../config/env";
import { retryWithBackoff } from "../utils/retry";

export interface VectorRecord {
  id: number;
  vector: number[];
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
  return err instanceof TypeError; // connection refused, DNS failure, etc.
}

export async function upsertVectors(namespace: string, records: VectorRecord[]): Promise<void> {
  if (records.length === 0) return;

  await retryWithBackoff(
    async () => {
      const res = await fetch(`${env.vectorServiceUrl}/vectors/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace, records }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new VectorServiceError(`Vector service upsert failed (${res.status}): ${body}`, res.status);
      }
    },
    {
      attempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 8000,
      isRetryable,
      onRetry: (err, attempt, delayMs) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[vector-store] upsert failed (attempt ${attempt}), retrying in ${delayMs}ms: ${message}`);
      },
    }
  );
}
