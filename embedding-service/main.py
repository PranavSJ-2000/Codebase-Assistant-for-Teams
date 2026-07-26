import os

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# Small, fast, CPU-friendly model — good enough for a demo corpus and quick
# to download (~80MB) compared to larger sentence-transformers models.
MODEL_NAME = os.environ.get("MODEL_NAME", "all-MiniLM-L6-v2")

model = SentenceTransformer(MODEL_NAME)
EMBEDDING_DIM = model.get_sentence_embedding_dimension()

app = FastAPI(title="Codebase Assistant Embedding Service")


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dim: int


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dim": EMBEDDING_DIM}


@app.post("/embed", response_model=EmbedResponse)
def embed(payload: EmbedRequest):
    if not payload.texts:
        return EmbedResponse(embeddings=[], dim=EMBEDDING_DIM)

    # Normalization for cosine similarity happens on the vector-service side
    # (it normalizes on both upsert and search), so this stays a plain encode.
    vectors = model.encode(payload.texts, show_progress_bar=False)
    return EmbedResponse(embeddings=vectors.tolist(), dim=EMBEDDING_DIM)
