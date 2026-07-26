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
