export type RepoStatus = "pending" | "processing" | "ready" | "failed";

export interface CreateRepoResponse {
  repoId: string;
  status: RepoStatus;
  owner: string;
  name: string;
}

export interface RepoDocument {
  _id: string;
  githubUrl: string;
  owner: string;
  name: string;
  status: RepoStatus;
  totalFiles: number;
  totalChunks: number;
  processedFiles: number;
  processedChunks: number;
  error?: string;
}

export interface SourceRef {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  streaming?: boolean;
  errorText?: string;
}
