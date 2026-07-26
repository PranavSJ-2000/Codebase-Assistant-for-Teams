import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import simpleGit from "simple-git";

const GITHUB_URL_PATTERN =
  /^https:\/\/github\.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+?)(?:\.git)?\/?$/;

export interface ParsedGithubUrl {
  owner: string;
  name: string;
}

export function parseGithubUrl(url: string): ParsedGithubUrl {
  const match = GITHUB_URL_PATTERN.exec(url.trim());
  if (!match || !match.groups) {
    throw new Error(
      "Invalid GitHub URL. Expected something like https://github.com/owner/repo"
    );
  }
  return { owner: match.groups.owner, name: match.groups.name };
}

export async function cloneRepo(githubUrl: string): Promise<string> {
  const cloneDir = await mkdtemp(path.join(tmpdir(), `repo-${randomUUID()}-`));

  try {
    await simpleGit().clone(githubUrl, cloneDir, ["--depth", "1"]);
  } catch (err) {
    await rm(cloneDir, { recursive: true, force: true });
    throw new Error(
      `Failed to clone ${githubUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return cloneDir;
}

export async function cleanupClone(cloneDir: string): Promise<void> {
  await rm(cloneDir, { recursive: true, force: true });
}
