import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const MAX_FILE_SIZE_BYTES = 300 * 1024; // 300 KB

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
  ".turbo",
  "coverage",
  "vendor",
  "target", // rust/java build output
]);

// extension -> language label, used later for chunking strategy selection
export const CODE_EXTENSIONS: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".sh": "shell",
  ".sql": "sql",
  ".md": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
};

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  language: string;
  sizeBytes: number;
}

async function isProbablyBinary(filePath: string): Promise<boolean> {
  const handle = await readFile(filePath).catch(() => null);
  if (!handle) return true;
  // A null byte in the first chunk is a strong signal of a binary file.
  const sample = handle.subarray(0, 8000);
  return sample.includes(0);
}

export async function walkRepoFiles(rootDir: string): Promise<WalkedFile[]> {
  const results: WalkedFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        await walk(path.join(dir, entry.name));
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const language = CODE_EXTENSIONS[ext];
      if (!language) continue;

      const absolutePath = path.join(dir, entry.name);
      const stats = await stat(absolutePath);
      if (stats.size === 0 || stats.size > MAX_FILE_SIZE_BYTES) continue;

      if (await isProbablyBinary(absolutePath)) continue;

      results.push({
        absolutePath,
        relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/"),
        language,
        sizeBytes: stats.size,
      });
    }
  }

  await walk(rootDir);
  return results;
}
