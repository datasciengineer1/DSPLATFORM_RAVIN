import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "bge-m3";

async function fetchJSON(url:string, body:any, timeoutMs=20000){
  const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), timeoutMs);
  try{
    const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    let j:any; try{ j = JSON.parse(text); }catch{ throw new Error(`NON_JSON from ${url}: ${text.slice(0,160)}`); }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0,160)}`);
    return j;
  } finally { clearTimeout(t); }
}

export async function POST(req:Request){
  try{
    const payload = await req.json().catch(()=>({}));
    const texts: string[] = Array.isArray(payload?.texts) ? payload.texts
                    : (payload?.text ? [String(payload.text)] : []);
    if (!texts.length) return NextResponse.json({ ok:false, error:"Missing 'texts' or 'text'." }, { status:400 });

    // Ollama embeddings API accepts { model, prompt } (single); loop per text for now.
    const out:number[][] = [];
    for (const t of texts){
      const j = await fetchJSON(`${OLLAMA_URL}/api/embeddings`, { model: OLLAMA_EMBED_MODEL, prompt: t }, 30000);
      const v = j?.embedding;
      if (!v || !Array.isArray(v)) throw new Error("Ollama returned no embedding");
      out.push(v);
    }
    return NextResponse.json({ ok:true, dense: out, model: OLLAMA_EMBED_MODEL });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:502 });
  }
}
