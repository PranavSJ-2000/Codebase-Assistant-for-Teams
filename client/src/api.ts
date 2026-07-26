import type { CreateRepoResponse, RepoDocument } from "./types";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed with status ${res.status}`);
  }
  return body as T;
}

export async function createRepo(githubUrl: string): Promise<CreateRepoResponse> {
  const res = await fetch("/api/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubUrl }),
  });
  return parseJsonOrThrow<CreateRepoResponse>(res);
}

export async function getRepo(repoId: string): Promise<RepoDocument> {
  const res = await fetch(`/api/repos/${repoId}`);
  return parseJsonOrThrow<RepoDocument>(res);
}
