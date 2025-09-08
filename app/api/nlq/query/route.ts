import { NextResponse } from "next/server";
import { readCache, upsertCache, hashId, type CacheItem } from "@/lib/cache";
import { cosine, lexicalCosine } from "@/lib/hybrid";

const OLLAMA_URL   = process.env.OLLAMA_URL   || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const EMBED_SERVER = process.env.EMBED_SERVER || "http://127.0.0.1:7070";
const RERANK_SERVER= process.env.RERANK_SERVER|| "http://127.0.0.1:7070";

type Weights = { dense:number; sparse:number; cross:number };

async function embedAll(texts:string[]){
  const r = await fetch(`${EMBED_SERVER}/embed`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ texts }) });
  if (!r.ok) throw new Error("embed server failed");
  return r.json() as Promise<{ dense:number[][]; sparse:Array<Record<string,number>>; colbert:number[][][] }>;
}

async function rerank(query:string, candidates:string[]){
  const r = await fetch(`${RERANK_SERVER}/rerank`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ query, candidates }) });
  if (!r.ok) throw new Error("rerank server failed");
  const j = await r.json() as { scores:number[] };
  return j.scores;
}

async function ollamaExplain(prompt:string){
  try{
    const body = { model: OLLAMA_MODEL, prompt, stream:false, options:{ temperature:0.2 } };
    const r = await fetch(`${OLLAMA_URL}/api/generate`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    return j?.response || j?.message?.content || "No response from Ollama.";
  }catch{
    return "Ollama not reachable. Start Ollama and pull a chat model (e.g., `mistral`).";
  }
}

export async function POST(req:Request){
  const { nlq, language="auto", weights={dense:0.5,sparse:0.3,cross:0.2} as Weights, forceFresh=false } = await req.json();
  if (!nlq || typeof nlq !== "string") return NextResponse.json({ error:"Missing nlq" }, { status:400 });

  const items = readCache();
  // 1) embed query (dense+sparse+colbert)
  const qEmb = await embedAll([nlq]);
  const qDense = qEmb.dense[0]||[];
  const qSparse = qEmb.sparse[0]||{};

  // 2) compute hybrid scores vs cache
  const scored = items.map(it=>{
    const cos = it.dense?.length ? cosine(qDense, it.dense) : 0;
    const sp  = it.sparse ? lexicalCosine(qSparse, it.sparse) : 0;
    return { id:it.id, question:it.question, cosine:cos, sparse:sp, rerank:0, _it:it };
  }).sort((a,b)=> (b.cosine + b.sparse) - (a.cosine + a.sparse)).slice(0,8);

  // 3) cross-encoder rerank top candidates
  const rerankScores = scored.length ? await rerank(nlq, scored.map(s=>s.question)) : [];
  scored.forEach((s,i)=> s.rerank = rerankScores[i] ?? 0);

  // 4) weighted combine to decide cache hit
  const wsum = Math.max(1e-6, weights.dense + weights.sparse + weights.cross);
  const wd = weights.dense/wsum, ws = weights.sparse/wsum, wc = weights.cross/wsum;
  scored.sort((a,b)=> (wd*b.cosine + ws*b.sparse + wc*b.rerank) - (wd*a.cosine + ws*a.sparse + wc*a.rerank));

  const top = scored[0];
  const combinedTop = top ? (wd*top.cosine + ws*top.sparse + wc*top.rerank) : 0;
  const fromCache = !forceFresh && !!top && (top.cosine>0.92 || top.rerank>0.85 || combinedTop>0.80);

  let explanation:string, matchId:string|undefined;
  if (fromCache){
    explanation = `Using cached explanation for similar question:\n“${top.question}”.\n(Use force fresh or delete cache to regenerate.)`;
    matchId = top.id;
  } else {
    explanation = await ollamaExplain(nlq);
    // Embed the new question too (already have qDense/qSparse)
    const rec: CacheItem = {
      id: hashId(nlq),
      question: nlq,
      lang: language,
      explanation,
      ts: new Date().toISOString(),
      dense: qDense,
      sparse: qSparse,
      colbert: [] // optional: store if you plan to use token-level scoring
    };
    upsertCache(rec);
    matchId = rec.id;
  }

  const crossEncoderExplanation = [
    "We combine three signals:",
    "1) Dense cosine — multilingual semantic similarity (BGE-M3).",
    "2) Sparse/lexical — learned token weights (BGE-M3).",
    "3) Cross-encoder — multilingual reranker reads query+candidate together.",
    "Weights are configurable on the NLQ page."
  ].join(" ");

  return NextResponse.json({
    fromCache,
    explanation,
    matchId,
    retrieval: {
      combinedTop,
      weights,
      hits: scored.map(s=>({ id:s.id, question:s.question, cosine:s.cosine, sparse:s.sparse, rerank:s.rerank }))
    },
    crossEncoderExplanation
  });
}
