import type { ChunkPayload } from "../types/ingestion";

const MAX_CHUNK_CHARS = 1600;
const WINDOW_CHARS = 1200;
const OVERLAP_CHARS = 200;

interface RawChunk {
  content: string;
  startLine: number;
  endLine: number;
  symbol?: string;
}

// Heuristic, not a real parser: matches top-level-ish function/class/arrow
// declarations. Good enough to find likely chunk boundaries; false
// negatives just fall back to being swept into a leftover/window chunk.
const JS_DECL_PATTERN =
  /^\s{0,4}(export\s+)?(default\s+)?(async\s+)?(function\s*\*?\s+(?<fnName>[\w$]+)|class\s+(?<className>[\w$]+)|(?:const|let|var)\s+(?<varName>[\w$]+)\s*=\s*(async\s*)?\(?[^=]*=>|(?<methodName>[\w$]+)\s*\([^)]*\)\s*\{)/;

const PY_DECL_PATTERN = /^(?<indent>\s*)(async\s+def|def|class)\s+(?<name>\w+)/;

function chunkJsLike(lines: string[]): RawChunk[] {
  const chunks: RawChunk[] = [];
  let i = 0;
  let leftoverStart: number | null = null;

  const flushLeftover = (endExclusive: number) => {
    if (leftoverStart === null) return;
    const slice = lines.slice(leftoverStart, endExclusive);
    if (slice.some((l) => l.trim().length > 0)) {
      chunks.push({
        content: slice.join("\n"),
        startLine: leftoverStart + 1,
        endLine: endExclusive,
      });
    }
    leftoverStart = null;
  };

  while (i < lines.length) {
    const match = JS_DECL_PATTERN.exec(lines[i]);
    if (!match) {
      if (leftoverStart === null) leftoverStart = i;
      i += 1;
      continue;
    }

    flushLeftover(i);

    const startLine = i;
    let depth = 0;
    let seenBrace = false;
    let j = i;
    for (; j < lines.length; j += 1) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth += 1;
          seenBrace = true;
        } else if (ch === "}") {
          depth -= 1;
        }
      }
      if (seenBrace && depth <= 0) {
        j += 1;
        break;
      }
    }
    // Arrow functions without braces (e.g. `const f = (x) => x + 1`) never
    // set seenBrace — treat as a single-line declaration.
    if (!seenBrace) j = startLine + 1;

    const symbol =
      match.groups?.fnName ?? match.groups?.className ?? match.groups?.varName ?? match.groups?.methodName;

    chunks.push({
      content: lines.slice(startLine, j).join("\n"),
      startLine: startLine + 1,
      endLine: j,
      symbol,
    });

    i = j;
  }

  flushLeftover(lines.length);
  return chunks;
}

function chunkPython(lines: string[]): RawChunk[] {
  const topLevelStarts: { line: number; name: string }[] = [];

  lines.forEach((line, idx) => {
    const match = PY_DECL_PATTERN.exec(line);
    if (match && match.groups?.indent === "") {
      topLevelStarts.push({ line: idx, name: match.groups.name });
    }
  });

  if (topLevelStarts.length === 0) return [];

  const chunks: RawChunk[] = [];

  if (topLevelStarts[0].line > 0) {
    const preamble = lines.slice(0, topLevelStarts[0].line);
    if (preamble.some((l) => l.trim().length > 0)) {
      chunks.push({
        content: preamble.join("\n"),
        startLine: 1,
        endLine: topLevelStarts[0].line,
      });
    }
  }

  topLevelStarts.forEach((decl, idx) => {
    const end = idx + 1 < topLevelStarts.length ? topLevelStarts[idx + 1].line : lines.length;
    chunks.push({
      content: lines.slice(decl.line, end).join("\n"),
      startLine: decl.line + 1,
      endLine: end,
      symbol: decl.name,
    });
  });

  return chunks;
}

// Fallback for languages without a heuristic above, and for any individual
// chunk that came out too large: a fixed character window with overlap.
// (Character count is a rough proxy for tokens — swapping in a real
// tokenizer later is a drop-in change to this one function.)
function chunkFixedWindow(content: string, baseStartLine: number): RawChunk[] {
  if (content.length === 0) return [];

  const lineStartOffsets: number[] = [0];
  for (let idx = 0; idx < content.length; idx += 1) {
    if (content[idx] === "\n") lineStartOffsets.push(idx + 1);
  }
  const offsetToLine = (offset: number) => {
    let lo = 0;
    let hi = lineStartOffsets.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStartOffsets[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const chunks: RawChunk[] = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + WINDOW_CHARS, content.length);
    chunks.push({
      content: content.slice(start, end),
      startLine: baseStartLine + offsetToLine(start),
      endLine: baseStartLine + offsetToLine(end),
    });
    if (end >= content.length) break;
    start = end - OVERLAP_CHARS;
  }
  return chunks;
}

function splitOversized(chunk: RawChunk): RawChunk[] {
  if (chunk.content.length <= MAX_CHUNK_CHARS) return [chunk];
  return chunkFixedWindow(chunk.content, chunk.startLine).map((c) => ({
    ...c,
    symbol: chunk.symbol,
  }));
}

export function chunkFile(content: string, language: string): ChunkPayload[] {
  const lines = content.split("\n");

  let rawChunks: RawChunk[];
  if (language === "javascript" || language === "typescript") {
    rawChunks = chunkJsLike(lines);
  } else if (language === "python") {
    rawChunks = chunkPython(lines);
  } else {
    rawChunks = [];
  }

  if (rawChunks.length === 0) {
    rawChunks = chunkFixedWindow(content, 1);
  }

  const finalChunks = rawChunks.flatMap(splitOversized);

  return finalChunks.map((chunk, index) => ({
    index,
    content: chunk.content,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    symbol: chunk.symbol,
  }));
}
