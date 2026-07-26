import { readFile } from "node:fs/promises";
import type { Request, Response } from "express";
import { Repo } from "../models/Repo";
import { embedRepoQueue } from "../queues/embedRepoQueue";
import { chunkFile } from "../services/chunker";
import { cleanupClone, cloneRepo, parseGithubUrl } from "../services/git";
import { walkRepoFiles } from "../services/fileWalker";
import type { EmbedFileJobData } from "../types/ingestion";

export async function createRepo(req: Request, res: Response): Promise<void> {
  const { githubUrl } = req.body as { githubUrl?: unknown };

  if (typeof githubUrl !== "string" || githubUrl.trim().length === 0) {
    res.status(400).json({ error: "githubUrl is required" });
    return;
  }

  let parsed: { owner: string; name: string };
  try {
    parsed = parseGithubUrl(githubUrl);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid githubUrl" });
    return;
  }

  const repo = await Repo.create({
    githubUrl: githubUrl.trim(),
    owner: parsed.owner,
    name: parsed.name,
    status: "pending",
  });

  // Cloning + chunking a whole repo can take well beyond a reasonable HTTP
  // timeout, so we respond immediately and let the client poll status.
  // Only the (cheap) DB write above is awaited.
  void ingestRepo(repo.id as string, githubUrl.trim()).catch((err) => {
    console.error(`[repos] Unhandled ingestion error for repo ${repo.id}:`, err);
  });

  res.status(202).json({
    repoId: repo.id,
    status: repo.status,
    owner: parsed.owner,
    name: parsed.name,
  });
}

async function ingestRepo(repoId: string, githubUrl: string): Promise<void> {
  await Repo.findByIdAndUpdate(repoId, { status: "processing" });

  let cloneDir: string;
  try {
    cloneDir = await cloneRepo(githubUrl);
  } catch (err) {
    await markFailed(repoId, err);
    return;
  }

  try {
    const files = await walkRepoFiles(cloneDir);

    const jobs: { name: string; data: EmbedFileJobData }[] = [];
    let chunkCount = 0;

    for (const file of files) {
      const content = await readFile(file.absolutePath, "utf8");
      const chunks = chunkFile(content, file.language);
      if (chunks.length === 0) continue;

      chunkCount += chunks.length;
      jobs.push({
        name: file.relativePath,
        data: {
          repoId,
          filePath: file.relativePath,
          language: file.language,
          chunks,
        },
      });
    }

    if (jobs.length === 0) {
      // Nothing embeddable (e.g. empty repo, or everything filtered out) —
      // there's no worker progress to wait on, so this repo is done.
      await Repo.findByIdAndUpdate(repoId, {
        status: "ready",
        totalFiles: 0,
        totalChunks: 0,
      });
      return;
    }

    await embedRepoQueue.addBulk(jobs);

    // Status stays "processing" — the embed-repo worker flips it to "ready"
    // once processedFiles reaches totalFiles.
    await Repo.findByIdAndUpdate(repoId, {
      totalFiles: jobs.length,
      totalChunks: chunkCount,
      processedFiles: 0,
      processedChunks: 0,
    });
  } catch (err) {
    await markFailed(repoId, err);
  } finally {
    await cleanupClone(cloneDir);
  }
}

async function markFailed(repoId: string, err: unknown): Promise<void> {
  console.error(`[repos] Ingestion failed for repo ${repoId}:`, err);
  await Repo.findByIdAndUpdate(repoId, {
    status: "failed",
    error: err instanceof Error ? err.message : String(err),
  });
}

export async function getRepo(req: Request, res: Response): Promise<void> {
  const repo = await Repo.findById(req.params.id);
  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }
  res.status(200).json(repo);
}
