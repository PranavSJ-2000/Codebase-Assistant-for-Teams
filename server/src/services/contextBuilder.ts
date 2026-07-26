export interface RetrievedChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

function formatChunk(chunk: RetrievedChunk): string {
  return `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.content}`;
}

// Greedily includes chunks — already ranked by similarity, highest first —
// until the next one would push the context past maxChars. Always includes
// at least one chunk (if any exist) even if it alone exceeds the budget, so
// a single oversized match doesn't silently produce empty context.
export function buildContext(
  chunks: RetrievedChunk[],
  maxChars: number
): { contextText: string; usedChunks: RetrievedChunk[] } {
  const used: RetrievedChunk[] = [];
  let total = 0;

  for (const chunk of chunks) {
    const blockLength = formatChunk(chunk).length + "\n\n---\n\n".length;
    if (used.length > 0 && total + blockLength > maxChars) break;
    used.push(chunk);
    total += blockLength;
  }

  const contextText = used.map(formatChunk).join("\n\n---\n\n");
  return { contextText, usedChunks: used };
}
