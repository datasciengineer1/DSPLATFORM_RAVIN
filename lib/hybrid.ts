import type { LexWeights } from "./cache";

// cosine for dense
export function cosine(a:number[] = [], b:number[] = []){
  const n = Math.min(a.length, b.length); if (!n) return 0;
  let dot=0, na=0, nb=0;
  for (let i=0;i<n;i++){ const x=a[i], y=b[i]; dot+=x*y; na+=x*x; nb+=y*y; }
  return dot / (Math.sqrt(na)||1) / (Math.sqrt(nb)||1);
}

// "lexical cosine": L2-normalized dot over shared terms
export function lexicalCosine(q:LexWeights={}, d:LexWeights={}){
  const keys = Object.keys(q); if (!keys.length || !Object.keys(d).length) return 0;
  let dot=0, nq=0, nd=0;
  for (const k of keys){ const x=q[k]; if (x) nq+=x*x; const y = d[k]; if (y) { dot+=x*y; nd+=y*y; } }
  // in case some keys only exist in doc
  for (const k in d){ const y=d[k]; if (y) nd+=0; }
  if (!nq || !nd) return 0;
  return dot / Math.sqrt(nq) / Math.sqrt(nd);
}
