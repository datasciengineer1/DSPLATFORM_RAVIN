import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchJSON(url:string, body:any){
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:false, error:"NON_JSON", raw:text }; }
}

export async function POST(req: Request){
  const body = await req.json().catch(()=> ({} as any));
  const nlq = (body?.nlq ?? "").toString();
  const detail = (body?.detail ?? "deep").toString();
  const provider = (body?.provider ?? "Stub (local)").toString();
  const weights = body?.weights || { dense:0.5, sparse:0.3, cross:0.2 };

  // 1) retrieval (local stub OR IR)
  let retrieval:any = null;
  try{
    if (provider==="Cohere (IR required)"){
      const r = await fetchJSON("http://127.0.0.1:7070/search", { q:nlq, weights });
      if (r?.hits) retrieval = { hits:r.hits, weights:r.weights||weights };
    } else {
      // local stub: echo query into a single pseudo-hit
      retrieval = { hits:[{ question:nlq, cosine:0.62, sparse:0.28, rerank:0.18, combined: 0.62*weights.dense + 0.28*weights.sparse + 0.18*weights.cross }], weights };
    }
  }catch(e:any){
    retrieval = { hits:[], weights, error:String(e?.message||e) };
  }

  // 2) explanation (Ollama; falls back with robust JSON)
  const ex = await fetchJSON("http://127.0.0.1:3120/api/nlq/explain", { nlq, detail, retrieval });

  return NextResponse.json({
    ok: !!ex?.structured,
    retrieval,
    explainStruct: ex?.structured || null,
    // markdown now rendered client-side from structured; keep for compatibility if you need
    explanation: null,
    provider: ex?.provider || "ollama",
    error: ex?.error || null
  });
}

export async function GET(){ return NextResponse.json({ ok:true }); }
