from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict
import math

app = FastAPI(title="IR Service")

class Weights(BaseModel):
    dense: float = 0.5
    sparse: float = 0.3
    cross: float = 0.2

class SearchReq(BaseModel):
    q: str
    k: int = 6
    weights: Weights = Weights()

class Hit(BaseModel):
    question: str
    cosine: float
    sparse: float
    rerank: float
    combined: float

class SearchResp(BaseModel):
    hits: List[Hit]
    weights: Weights

@app.get("/")
def root():
    return {"ok": True, "service": "ir"}

@app.post("/search", response_model=SearchResp)
def search(req: SearchReq):
    # Minimal, safe mock until your real retrieval plugs in:
    base = [
        req.q,
        f"{req.q} (variant 1)",
        f"{req.q} (variant 2)",
        f"Top drivers related to: {req.q}",
        f"Forecasting angle for: {req.q}",
        f"Mitigation strategies for: {req.q}",
    ][: max(1, min(req.k, 6))]

    hits: List[Hit] = []
    for i, q in enumerate(base):
        c = float(max(0.0, 0.8 - i*0.06))   # pretend dense
        s = float(max(0.0, 0.5 - i*0.05))   # pretend sparse
        x = float(max(0.0, 0.3 - i*0.04))   # pretend cross-encoder
        comb = float(c*req.weights.dense + s*req.weights.sparse + x*req.weights.cross)
        hits.append(Hit(question=q, cosine=c, sparse=s, rerank=x, combined=comb))

    return SearchResp(hits=hits, weights=req.weights)
