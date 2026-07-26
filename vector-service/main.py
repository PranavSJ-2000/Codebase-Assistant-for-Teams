import os
import re
import threading

import faiss
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 (see /embedding-service)
DATA_DIR = os.environ.get("DATA_DIR", "./data")
# Namespaces become filenames on disk, so keep them restricted.
NAMESPACE_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")

app = FastAPI(title="Codebase Assistant Vector Service")
_lock = threading.Lock()
# One FAISS index per namespace (one per repo, in this app) so a search
# against namespace "A" can never return vectors from namespace "B" — there's
# no metadata filtering on a flat index, so isolation has to be structural.
_indices: dict[str, faiss.IndexIDMap] = {}


def _validate_namespace(namespace: str) -> None:
    if not NAMESPACE_PATTERN.match(namespace):
        raise HTTPException(status_code=400, detail="namespace must match ^[a-zA-Z0-9_-]{1,128}$")


def _index_path(namespace: str) -> str:
    return os.path.join(DATA_DIR, f"{namespace}.faiss")


def _get_index(namespace: str) -> faiss.IndexIDMap:
    if namespace not in _indices:
        path = _index_path(namespace)
        if os.path.exists(path):
            _indices[namespace] = faiss.read_index(path)
        else:
            _indices[namespace] = faiss.IndexIDMap(faiss.IndexFlatIP(EMBEDDING_DIM))
    return _indices[namespace]


def _save_index(namespace: str) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    faiss.write_index(_indices[namespace], _index_path(namespace))


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


class VectorRecord(BaseModel):
    id: int
    vector: list[float]


class UpsertRequest(BaseModel):
    namespace: str
    records: list[VectorRecord]


class UpsertResponse(BaseModel):
    upserted: int
    vectorCount: int


class SearchRequest(BaseModel):
    namespace: str
    vector: list[float]
    topK: int = 5


class SearchMatch(BaseModel):
    id: int
    score: float


class SearchResponse(BaseModel):
    matches: list[SearchMatch]


@app.get("/health")
def health():
    with _lock:
        namespaces = {ns: idx.ntotal for ns, idx in _indices.items()}
    return {"status": "ok", "namespaces": namespaces, "dim": EMBEDDING_DIM}


@app.post("/vectors/upsert", response_model=UpsertResponse)
def upsert_vectors(payload: UpsertRequest):
    _validate_namespace(payload.namespace)

    if not payload.records:
        with _lock:
            return UpsertResponse(upserted=0, vectorCount=_get_index(payload.namespace).ntotal)

    for record in payload.records:
        if len(record.vector) != EMBEDDING_DIM:
            raise HTTPException(
                status_code=400,
                detail=f"vector for id={record.id} has dim {len(record.vector)}, expected {EMBEDDING_DIM}",
            )

    ids = np.array([r.id for r in payload.records], dtype=np.int64)
    vectors = _normalize(np.array([r.vector for r in payload.records], dtype=np.float32))

    with _lock:
        index = _get_index(payload.namespace)
        # Upsert semantics: drop any existing rows for these ids before
        # re-adding, since IndexIDMap doesn't overwrite in place.
        index.remove_ids(ids)
        index.add_with_ids(vectors, ids)
        _save_index(payload.namespace)
        vector_count = index.ntotal

    return UpsertResponse(upserted=len(payload.records), vectorCount=vector_count)


@app.post("/vectors/search", response_model=SearchResponse)
def search_vectors(payload: SearchRequest):
    _validate_namespace(payload.namespace)

    if len(payload.vector) != EMBEDDING_DIM:
        raise HTTPException(
            status_code=400,
            detail=f"query vector has dim {len(payload.vector)}, expected {EMBEDDING_DIM}",
        )

    with _lock:
        index = _get_index(payload.namespace)
        if index.ntotal == 0:
            return SearchResponse(matches=[])
        query = _normalize(np.array([payload.vector], dtype=np.float32))
        scores, ids = index.search(query, min(payload.topK, index.ntotal))

    matches = [
        SearchMatch(id=int(i), score=float(s))
        for i, s in zip(ids[0], scores[0])
        if i != -1
    ]
    return SearchResponse(matches=matches)
