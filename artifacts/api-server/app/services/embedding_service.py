"""Embedding service.

Generates vector embeddings for text chunks.

Configuration:
  EMBEDDING_PROVIDER  – e.g. "openai" (uses LLM_BASE_URL /embeddings)
  EMBEDDING_MODEL     – e.g. "text-embedding-3-small"

When those are unset the service falls back to a local hash-based
bag-of-words embedding so the RAG pipeline works without any external
dependency (lower quality but fully functional for development).
"""

import hashlib
import math
import re

import httpx
import numpy as np

from app.core.config import settings

EMBEDDING_DIM = 384  # matches common sentence-transformer output size


def _local_embedding(text: str) -> list[float]:
    """Hash-trick bag-of-words embedding (no external dependency)."""
    tokens = re.findall(r"\w+", text.lower())
    vec = np.zeros(EMBEDDING_DIM, dtype=float)
    for token in tokens:
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec.tolist()


async def embed_text(text: str) -> list[float]:
    """Generate an embedding for *text*, using the configured provider or local fallback."""
    if settings.embedding_configured:
        try:
            url = settings.llm_base_url.rstrip("/") + "/embeddings"
            headers: dict[str, str] = {"Content-Type": "application/json"}
            if settings.llm_api_key:
                headers["Authorization"] = f"Bearer {settings.llm_api_key}"
            payload = {"model": settings.embedding_model, "input": text}
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception:
            # Degrade gracefully to local embedding on any provider failure
            pass
    return _local_embedding(text)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    denom = float(np.linalg.norm(va)) * float(np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)
