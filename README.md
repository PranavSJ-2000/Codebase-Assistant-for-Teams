# Codebase Assistant for Teams

A RAG (Retrieval-Augmented Generation) application that lets you point it at a public
GitHub repository, indexes the codebase, and answers natural-language questions about
it — with streamed, token-by-token responses and citations back to the exact files and
line ranges the answer was drawn from.

The entire pipeline (embeddings, vector search, and the LLM itself) runs **locally, for
free** — no paid API keys required.

## What it does

1. Paste a public GitHub repo URL.
2. A background worker clones the repo, splits the source files into chunks (using
   function/class-boundary heuristics for JS/TS/Python, and fixed-size overlapping
   windows for everything else), and generates a vector embedding for each chunk.
3. Those vectors are stored in a per-repo FAISS index, with the chunk text and location
   metadata kept in MongoDB.
4. When you ask a question, the app embeds the question, retrieves the most relevant
   chunks for that specific repo, and streams an answer from a local LLM — grounded in
   that retrieved code, with the source files/lines shown alongside the answer.

## Tech stack

**Frontend**
- React 18 + TypeScript, built with Vite
- Plain `fetch` for requests, native `EventSource` for streaming chat responses (no
  extra state-management library — the UI state is simple enough not to need one)

**API server** (`/server`)
- Node.js + Express + TypeScript
- MongoDB via Mongoose (repo metadata, chunk-to-vector mapping, chat history)
- BullMQ (Redis-backed job queue) as the producer side of ingestion jobs
- Server-Sent Events (SSE) for streaming answers to the client

**Background worker** (`/workers`)
- Node.js + TypeScript, separate process from the API server
- BullMQ consumer: clones repos (`simple-git`), chunks files, calls the embedding
  service, and writes vectors + metadata

**Vector search** (`/vector-service`)
- Python + FastAPI
- [FAISS](https://github.com/facebookresearch/faiss) (Facebook AI Similarity Search),
  with one index per repository so a search against one repo can never return another
  repo's results

**Embeddings** (`/embedding-service`)
- Python + FastAPI
- [sentence-transformers](https://www.sbert.net/) (`all-MiniLM-L6-v2`, 384-dimensional
  embeddings), running on CPU

**LLM**
- [Ollama](https://ollama.com/) running `llama3.2:3b` locally, for the actual
  natural-language answer generation

**Infrastructure**
- MongoDB, Redis, and all three Python/LLM services run via Docker Compose
- Redis backs the BullMQ job queue between the API server and the worker

## Why a fully local stack?

The original design used OpenAI (embeddings + chat) and Pinecone (vector storage).
This was deliberately swapped out for a 100% local, free equivalent — Ollama,
sentence-transformers, and FAISS — so the whole project can run and be demoed without
any paid API key or ongoing cost. The tradeoff is response quality/speed versus a
larger hosted model, which is a reasonable and explainable tradeoff for a project like
this.

## Project structure

```
/client             React + Vite frontend
/server              Express API — HTTP endpoints, enqueues ingestion jobs, streams answers
/workers             BullMQ worker — clones repos, chunks files, generates embeddings
/vector-service      FastAPI + FAISS — stores and searches embedding vectors
/embedding-service   FastAPI + sentence-transformers — turns text into embeddings
docker-compose.yml   Mongo, Redis, vector-service, embedding-service, and Ollama
```

## Running it locally

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/),
[Node.js](https://nodejs.org/), and `git`.

```bash
# 1. Start the backing services (Mongo, Redis, vector search, embeddings, Ollama)
docker compose up -d

# 2. Pull the local LLM model (one-time, ~2GB download)
docker exec codebase-assistant-ollama ollama pull llama3.2:3b

# 3. Start the API server
cd server && npm install && npm run dev

# 4. Start the background worker (in a separate terminal)
cd workers && npm install && npm run dev

# 5. Start the frontend (in a separate terminal)
cd client && npm install && npm run dev
```

Then open **http://localhost:5173**.

Copy `.env.example` to `server/.env` and `workers/.env` if you need to change any of the
default local URLs/ports.
