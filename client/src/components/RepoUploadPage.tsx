import { useEffect, useRef, useState } from "react";
import { createRepo, getRepo } from "../api";
import type { RepoDocument, RepoStatus } from "../types";
import { BrandMark } from "./BrandMark";
import { ProgressBar } from "./ProgressBar";

const POLL_INTERVAL_MS = 1500;

const STATUS_LABEL: Record<RepoStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

function StatusPill({ status }: { status: RepoStatus }) {
  return <span className={`status-pill status-pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

interface RepoUploadPageProps {
  onRepoReady: (repoId: string) => void;
}

export function RepoUploadPage({ onRepoReady }: RepoUploadPageProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [repo, setRepo] = useState<RepoDocument | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const latest = await getRepo(id);
        setRepo(latest);
        if (latest.status === "ready" || latest.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) {
        // Transient poll failure — keep trying rather than surfacing noise.
        console.error("Failed to poll repo status:", err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const created = await createRepo(githubUrl.trim());
      setRepo(null);
      startPolling(created.repoId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start ingestion");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTerminal = repo?.status === "ready" || repo?.status === "failed";
  const isChunking = repo?.status === "processing" && repo.totalFiles === 0;
  const isEmbedding = repo?.status === "processing" && repo.totalFiles > 0;
  const percent = repo && repo.totalFiles > 0 ? (repo.processedFiles / repo.totalFiles) * 100 : 0;

  return (
    <div className="page-shell">
      <div className="upload-card">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Codebase Assistant</span>
        </div>

        <h1>Ask questions about any GitHub repo</h1>
        <p className="muted">Paste a public repo URL to index it, then chat with your codebase.</p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            disabled={isSubmitting || (repo !== null && !isTerminal)}
            required
          />
          <button type="submit" disabled={isSubmitting || !githubUrl.trim() || (repo !== null && !isTerminal)}>
            {isSubmitting ? "Starting…" : "Ingest repo"}
          </button>
        </form>

        {submitError && <p className="error-text">{submitError}</p>}

        {repo && (
          <div className="ingestion-status">
            <div className="ingestion-status-header">
              <span className="ingestion-status-repo">
                {repo.owner}/{repo.name}
              </span>
              <StatusPill status={repo.status} />
            </div>

            {repo.status === "pending" && <ProgressBar percent={15} label="Cloning repository…" indeterminate />}
            {isChunking && <ProgressBar percent={25} label="Cloning and chunking files…" indeterminate />}
            {isEmbedding && (
              <ProgressBar
                percent={percent}
                label={`Embedding files: ${repo.processedFiles}/${repo.totalFiles} (${repo.processedChunks}/${repo.totalChunks} chunks)`}
              />
            )}
            {repo.status === "ready" && (
              <>
                <ProgressBar
                  percent={100}
                  label={`Done — ${repo.totalFiles} files, ${repo.totalChunks} chunks embedded`}
                />
                <div className="btn-primary-row">
                  <button onClick={() => onRepoReady(repo._id)}>Start chatting →</button>
                </div>
              </>
            )}
            {repo.status === "failed" && <p className="error-text">Ingestion failed: {repo.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
