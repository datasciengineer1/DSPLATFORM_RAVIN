import os
from typing import List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel
from FlagEmbedding import BGEM3FlagModel
from sentence_transformers import CrossEncoder
from fastapi.responses import JSONResponse
from .jsonify import to_py


app = FastAPI(title="IR Local", version="1.0")

# --- Embeddings: BGE-M3 (multilingual, dense+sparse+multi-vector) ---
EMB_MODEL_NAME = os.environ.get("EMB_MODEL", "BAAI/bge-m3")
emb_model = BGEM3FlagModel(EMB_MODEL_NAME, use_fp16=False, device="cpu")

# --- Reranker: pick free multilingual cross-encoder ---
RERANK_MODEL = os.environ.get("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")  # or "jinaai/jina-reranker-v2-base-multilingual"
reranker = CrossEncoder(RERANK_MODEL, device="cpu")

class EmbedIn(BaseModel):
    texts: List[str]

@app.post("/embed")
def embed(inp: EmbedIn):
    out = emb_model.encode(
        inp.texts,
        return_dense=True,
        return_sparse=True,          # a.k.a. lexical weights
        return_colbert_vecs=True     # multi-vector (ColBERT-style)
    )
    dense = [v.tolist() for v in out["dense_vecs"]]
    # lexical weights is a list of dicts: [{token: weight, ...}, ...]
    sparse = out.get("lexical_weights", out.get("sparse_vecs", []))
    colbert = [v.tolist() for v in out.get("colbert_vecs", [])]
    return JSONResponse({"dense": to_py(dense), "sparse": to_py(sparse), "colbert": to_py(colbert)})

class RerankIn(BaseModel):
    query: str
    candidates: List[str]

@app.post("/rerank")
def rerank(inp: RerankIn):
    pairs = [(inp.query, c) for c in inp.candidates]
    scores = reranker.predict(pairs).tolist()  # higher = more relevant
    return JSONResponse({"scores": to_py(scores)})
