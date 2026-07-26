// Mirrors server/src/types/ingestion.ts — this is the payload contract for
// jobs on the "embed-repo" queue. Keep both copies in sync by hand until
// this becomes a shared package.
export interface ChunkPayload {
  index: number;
  content: string;
  startLine: number;
  endLine: number;
  symbol?: string;
}

export interface EmbedFileJobData {
  repoId: string;
  filePath: string;
  language: string;
  chunks: ChunkPayload[];
}
