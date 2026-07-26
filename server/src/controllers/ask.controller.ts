import type { Request, Response } from "express";
import mongoose from "mongoose";
import { CHAT_SYSTEM_PROMPT, MAX_CONTEXT_CHARS, RETRIEVAL_TOP_K } from "../config/rag";
import { ChatHistory } from "../models/ChatHistory";
import { Chunk } from "../models/Chunk";
import { Repo } from "../models/Repo";
import { embedText } from "../services/embeddings";
import type { ChatMessage } from "../services/llm";
import { streamChatCompletion } from "../services/llm";
import type { RetrievedChunk } from "../services/contextBuilder";
import { buildContext } from "../services/contextBuilder";
import { searchVectors } from "../services/vectorStore";

export async function askQuestion(req: Request, res: Response): Promise<void> {
  const { id: repoId } = req.params;
  // GET + query params (not POST + body) because the client streams this
  // via EventSource, which can only issue GET requests.
  const { question, userId } = req.query as { question?: unknown; userId?: unknown };

  if (!mongoose.isValidObjectId(repoId)) {
    res.status(400).json({ error: "Invalid repo id" });
    return;
  }
  if (typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "question is required" });
    return;
  }
  // No auth system yet — the caller passes userId directly. Swap this for
  // req.user.id once auth exists.
  if (typeof userId !== "string" || userId.trim().length === 0) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const repo = await Repo.findById(repoId);
  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }
  if (repo.processedChunks === 0) {
    res.status(409).json({ error: `Repo has no embedded chunks yet (status: ${repo.status})` });
    return;
  }

  const trimmedQuestion = question.trim();
  let retrievedChunks: RetrievedChunk[];
  try {
    const questionVector = await embedText(trimmedQuestion);
    const matches = await searchVectors(repoId, questionVector, RETRIEVAL_TOP_K);

    if (matches.length === 0) {
      retrievedChunks = [];
    } else {
      const scoreById = new Map(matches.map((m) => [m.id, m.score]));
      const chunkDocs = await Chunk.find({
        repoId,
        vectorId: { $in: matches.map((m) => m.id) },
      }).lean();

      retrievedChunks = chunkDocs
        .map((c) => ({
          filePath: c.filePath,
          startLine: c.startLine,
          endLine: c.endLine,
          content: c.content,
          score: scoreById.get(c.vectorId) ?? 0,
        }))
        .sort((a, b) => b.score - a.score);
    }
  } catch (err) {
    res.status(502).json({
      error: `Failed to retrieve context: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // Guardrail: cap total context size and drop lowest-relevance chunks
  // (already sorted highest-score first) once the budget is exceeded.
  const { contextText, usedChunks } = buildContext(retrievedChunks, MAX_CONTEXT_CHARS);

  const messages: ChatMessage[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    {
      role: "user",
      content: contextText
        ? `Context from the repository:\n\n${contextText}\n\nQuestion: ${trimmedQuestion}`
        : `No relevant context was found in the repository. Question: ${trimmedQuestion}`,
    },
  ];

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(
    `event: sources\ndata: ${JSON.stringify(
      usedChunks.map((c) => ({ filePath: c.filePath, startLine: c.startLine, endLine: c.endLine }))
    )}\n\n`
  );

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  let fullAnswer = "";
  try {
    fullAnswer = await streamChatCompletion({
      messages,
      signal: abortController.signal,
      onToken: (token) => {
        if (res.writableEnded) return;
        res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      },
    });
  } catch (err) {
    if (!res.writableEnded) {
      // Named "stream-error", not "error" — EventSource reserves the
      // "error" event name for connection-level failures, and a server-sent
      // event literally named "error" would fire the same client handler.
      res.write(
        `event: stream-error\ndata: ${JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        })}\n\n`
      );
      res.end();
    }
    return;
  }

  if (!res.writableEnded) {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }

  await ChatHistory.create({
    repoId,
    userId: userId.trim(),
    question: trimmedQuestion,
    answer: fullAnswer,
    retrievedChunks: usedChunks.map((c) => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      score: c.score,
    })),
  });
}
