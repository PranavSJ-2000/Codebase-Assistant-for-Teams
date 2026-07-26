import { env } from "../config/env";
import { retryWithBackoff } from "../utils/retry";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatCompletionOptions {
  messages: ChatMessage[];
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

class OllamaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OllamaApiError";
    this.status = status;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OllamaApiError) return err.status >= 500;
  // Also covers the Ollama container still starting up / model still loading.
  return err instanceof TypeError;
}

// Streams a chat completion from a local Ollama model, invoking onToken for
// each content fragment and resolving with the full concatenated answer.
//
// Ollama's /api/chat streams newline-delimited JSON objects — one complete
// JSON object per line, each carrying a partial `message.content` — which is
// a different wire format from OpenAI's SSE "data: {...}" framing, so this
// parses differently from the old OpenAI client even though the calling
// shape (onToken callback, returns full text) stays the same.
//
// As before, retry/backoff only covers *opening* the stream — once tokens
// are reaching the client we don't retry, to avoid re-sending output.
export async function streamChatCompletion({
  messages,
  onToken,
  signal,
}: StreamChatCompletionOptions): Promise<string> {
  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(`${env.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.ollamaModel, messages, stream: true }),
        signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new OllamaApiError(`Ollama chat request failed (${res.status}): ${body}`, res.status);
      }
      return res;
    },
    { attempts: 3, baseDelayMs: 1000, maxDelayMs: 8000, isRetryable }
  );

  if (!response.body) throw new Error("Ollama response had no body to stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
          const token = parsed.message?.content;
          if (token) {
            fullText += token;
            onToken(token);
          }
        } catch {
          // Partial line split across a chunk boundary — skip it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
