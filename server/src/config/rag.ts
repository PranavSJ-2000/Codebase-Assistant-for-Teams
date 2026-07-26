export const RETRIEVAL_TOP_K = 8;

// Character count is a rough proxy for tokens (~4 chars/token for English
// text and code). 12000 chars ≈ 3000 tokens of context, leaving headroom
// in the model's context window for the system prompt and answer.
export const MAX_CONTEXT_CHARS = 12000;

export const CHAT_SYSTEM_PROMPT =
  "You are a coding assistant answering questions about a specific codebase. " +
  "Use only the provided context chunks to answer — if they don't contain enough " +
  "information, say so instead of guessing. When relevant, reference the file " +
  "paths and line numbers given in the context.";
