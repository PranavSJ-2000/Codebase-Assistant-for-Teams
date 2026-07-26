export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, maxDelayMs = 10000, isRetryable = () => true, onRetry } = options;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isRetryable(err)) throw err;

      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      onRetry?.(err, attempt, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
