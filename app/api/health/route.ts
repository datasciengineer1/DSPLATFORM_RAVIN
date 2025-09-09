import { NextResponse } from "next/server";

const OLLAMA_URL   = process.env.OLLAMA_URL   || "http://127.0.0.1:11434";
const EMBED_SERVER = process.env.EMBED_SERVER || "http://127.0.0.1:7070";
const RERANK_SERVER= process.env.RERANK_SERVER|| "http://127.0.0.1:7070";

async function tryFetch(url:string, init:any, timeoutMs=6000){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), timeoutMs);
  try{
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const ok = r.ok;
    let body = "";
    try { body = await r.text(); } catch {}
    return { ok, status:r.status, body: body.slice(0,200) };
  }catch(e:any){
    return { ok:false, status:0, body: String(e?.message||e) };
  }finally{ clearTimeout(t); }
}

export async function GET(){
  const [embed, rerank, ollama] = await Promise.all([
    tryFetch(`${EMBED_SERVER}/embed`,  { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ texts:["ping"] }) }),
    tryFetch(`${RERANK_SERVER}/rerank`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ query:"ping", candidates:["pong"] }) }),
    tryFetch(`${OLLAMA_URL}/api/tags`, { method:"GET" })
  ]);
  const embedUp  = embed.ok;
  const rerankUp = rerank.ok;
  const irUp     = embedUp && rerankUp;
  const ollamaUp = ollama.ok;
  return NextResponse.json({
    ok:true,
    irUp, embedUp, rerankUp, ollamaUp,
    details:{
      embed:{ status:embed.status, note:embed.body },
      rerank:{ status:rerank.status, note:rerank.body },
      ollama:{ status:ollama.status, note:ollama.body }
    }
  });
}
