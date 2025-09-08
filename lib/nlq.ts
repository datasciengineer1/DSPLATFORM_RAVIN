import { readCache } from "./cache";

// --- STUB multilingual embedding (replace with real provider later) ---
// We map text -> 256-d vector using hashed token buckets; deterministic & local.
export function embedStub(text:string): number[] {
  const dim=256, v=new Array(dim).fill(0);
  for(const raw of text.toLowerCase().split(/[\s,.;:!?()"/\\]+/).filter(Boolean)){
    let h=0; for(const c of raw){ h = (h*31 + c.charCodeAt(0))>>>0; }
    const i = h % dim; v[i] += 1;
  }
  // l2 normalize
  let s=0; for(const x of v) s+=x*x; s=Math.sqrt(s)||1;
  return v.map(x=>x/s);
}
export function cosine(a:number[], b:number[]){
  let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s += a[i]*b[i];
  return s;
}

// Sparse score: simple token overlap ratio (0..1)
export function sparseOverlap(q:string, doc:string){
  const tok = (s:string)=> new Set(s.toLowerCase().split(/[\s,.;:!?()"/\\]+/).filter(Boolean));
  const A = tok(q), B = tok(doc);
  let inter=0; A.forEach(t=>{ if(B.has(t)) inter++; });
  const denom = Math.max(1, Math.sqrt(A.size*B.size));
  return inter/denom;
}

export type Hit = { id:string; question:string; cosine:number; sparse:number; rerank:number; lang?:string; ts?:string };

export function searchSimilar(query:string, qvec:number[], weights:{dense:number;sparse:number;cross:number}): {hits:Hit[], top:number}{
  const wsum = Math.max(1e-6, weights.dense + weights.sparse + weights.cross);
  const wd = weights.dense/wsum, ws=weights.sparse/wsum, wc=weights.cross/wsum;

  const items = readCache();
  const scored = items.map(it=>{
    const cos = it.vec ? cosine(qvec, it.vec) : sparseOverlap(query, it.question)*0.6;
    const sp = sparseOverlap(query, it.question);
    // cross-encoder placeholder: emphasize phrase order/co-occurrence (approx via overlap^2)
    const cross = Math.min(1, Math.pow(sp, 2) * 1.2 + 0.1 * (cos>0.8?1:0));
    const combined = wd*cos + ws*sp + wc*cross;
    return { id:it.id, question:it.question, cosine:cos, sparse:sp, rerank:cross, combined, lang:it.lang, ts:it.ts };
  }).sort((a,b)=>b.combined-a.combined).slice(0,5);
  return { hits: scored.map(({combined, ...r})=>r), top: (scored[0]?.combined ?? 0) };
}
