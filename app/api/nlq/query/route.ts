import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchJSON(url:string, body:any){
  try{
    const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) return { ok:false, status:r.status, raw:text };
    try { return JSON.parse(text); } catch { return { ok:false, error:"NON_JSON", raw:text }; }
  }catch(e:any){
    return { ok:false, error:String(e?.message||e) };
  }
}

export async function POST(req: Request){
  const body = await req.json().catch(()=> ({} as any));
  const nlq = (body?.nlq ?? "").toString();
  const detail = (body?.detail ?? "deep").toString();
  const provider = (body?.provider ?? "Stub (local)").toString();
  const weights = body?.weights || { dense:0.5, sparse:0.3, cross:0.2 };

  // 1) retrieval (IR or stub)
  let retrieval:any = null;
  if (provider==="Cohere (IR required)"){
    const r = await fetchJSON("http://127.0.0.1:7070/search", { q:nlq, weights });
    if (r?.hits) retrieval = { hits:r.hits, weights:r.weights||weights };
    else retrieval = { hits:[], weights, error: r?.error || `IR status ${r?.status||"?"}` };
  } else {
    retrieval = { hits:[{ question:nlq, cosine:0.62, sparse:0.28, rerank:0.18, combined: 0.62*weights.dense + 0.28*weights.sparse + 0.18*weights.cross }], weights };
  }

  // 2) explanation (via local Next route that talks to Ollama; robust JSON)
  const ex = await fetchJSON("http://127.0.0.1:3120/api/nlq/explain", { nlq, detail, retrieval });

  return NextResponse.json({
    ok: !!ex?.structured,
    retrieval,
    explainStruct: ex?.structured || null,
    explanation: null,
    provider: ex?.provider || "ollama",
    error: ex?.error || retrieval?.error || null
  });
}

export async function GET(){ return NextResponse.json({ ok:true }); }
