const STORAGE_KEY = "codebase-assistant:userId";

// Stopgap until real auth exists — a stable per-browser id so ChatHistory
// rows can at least be grouped by "who asked this".
export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
