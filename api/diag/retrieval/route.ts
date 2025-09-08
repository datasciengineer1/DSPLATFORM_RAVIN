export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiagItem = { id:string; title?:string; embedScore:number; rerankScore?:number };
type Diag = {
  enabled:boolean; backend?:string;
  embedder?:{ name:string; dim:number; multilingual?:boolean };
  reranker?:{ enabled:boolean; name?:string; error?:string };
  topk?:number; items?:DiagItem[]; metrics?:{ ndcg_embed?:number; ndcg_rerank?:number };
  explain?:string[]; error?:string;
};

function ndcg(sc:number[]){ if(!sc?.length) return 0; const s=sc.reduce((a,b)=>a+b,0)||1; return sc.reduce((acc,v,i)=>acc+v/Math.log2(i+2),0)/s; }
function cos(a:number[],b:number[]){ let n=0,da=0,db=0; for(let i=0;i<a.length;i++){const x=a[i],y=b[i]; n+=x*y; da+=x*x; db+=y*y;} const d=Math.sqrt(da)*Math.sqrt(db)||1; return n/d; }
function toDocs(rows:any[]){ const out:string[]=[]; for(const r of rows.slice(0,300)){ if(r&&typeof r==="object"&&!Array.isArray(r)) out.push(Object.entries(r).filter(([,v])=>v!=null&&v!=="").map(([k,v])=>`${k}: ${v}`).join(" | ")); else out.push(String(r)); } return out; }

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const q = String(body?.q ?? "").trim();
  const datasetId = String(body?.datasetId ?? "").trim();
  const TOPK = Number(body?.topk ?? process.env.TOPK ?? 6);
  const EMBED = String(body?.embedModel ?? process.env.EMBED_MODEL ?? "Xenova/multilingual-e5-small");
  const RERANK = String(body?.rerankModel ?? process.env.RERANK_MODEL ?? "Xenova/ms-marco-MiniLM-L-6-v2");
  if (!q) return Response.json({ enabled:false, error:"empty query" });

  // sample rows
  let rows:any[] = [];
  try {
    const origin = new URL(req.url).origin;
    const r = await fetch(`${origin}/api/data/preview`, {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ name: datasetId || "demo", limit: 300 }), cache:"no-store"
    });
    if (r.ok) { const j = await r.json().catch(()=>({})); if (Array.isArray(j?.rows)) rows = j.rows; }
  } catch {}
  if (!rows.length) rows = Array.from({length:30},(_,i)=>({city:`City ${i+1}`, revenue:1000+Math.random()*9000, month:(i%12)+1}));

  // dynamic imports + cache outside repo
  let env:any, pipeline:any;
  try {
    const ort = await import("onnxruntime-web"); (globalThis as any).ort = (globalThis as any).ort || ort;
    (globalThis as any).onnxruntime = (globalThis as any).onnxruntime || ort;
  } catch (e:any) {
    return Response.json({ enabled:false, error:"onnxruntime-web import failed: "+(e?.message||String(e)) });
  }
  try {
    const t = await import("@xenova/transformers");
    env = t.env; pipeline = t.pipeline;
    const path = (await import("path")).default;
    const fs = (await import("fs")).default;
    const os = (await import("os")).default;
    const raw = process.env.TRANSFORMERS_CACHE || "";
    const cacheRoot = raw ? raw.replace("$HOME", os.homedir()) : path.join(os.homedir(), ".cache", "transformers-js");
    try { fs.mkdirSync(cacheRoot, { recursive:true }); } catch {}
    env.allowRemoteModels = true; env.allowLocalModels = true; env.localModelPath = cacheRoot;
    env.HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN || "";
  } catch (e:any) {
    return Response.json({ enabled:false, error:"transformers.js import failed: "+(e?.message||String(e)) });
  }

  try {
    const fe = await pipeline("feature-extraction", EMBED);
    const qEmbT:any = await fe(q, { pooling:"mean", normalize:true });
    const qEmb = Array.from(qEmbT.data) as number[];

    const docs = toDocs(rows);
    const docEmbs:number[][] = [];
    for (const d of docs) {
      const r:any = await fe(d, { pooling:"mean", normalize:true });
      docEmbs.push(Array.from(r.data) as number[]);
    }

    let items: DiagItem[] =
      docEmbs.map((e,i)=>({i,s:cos(qEmb,e)}))
             .sort((a,b)=>b.s-a.s).slice(0,TOPK)
             .map(({i,s})=>({ id:String(i), title:(docs[i]||"").slice(0,96), embedScore:s }));

    const ndcg_embed = ndcg(items.map(x=>x.embedScore));
    let ndcg_rerank: number | undefined;
    let reranker = { enabled:false, name:RERANK } as NonNullable<Diag["reranker"]>;

    try {
      const ce = await pipeline("text-classification", RERANK);
      const pairs = items.map(it => `${q} [SEP] ${docs[Number(it.id)]}`);
      const outputs:any[] = await ce(pairs, { top_k: 1 });
      const probs = outputs.map(o => (Array.isArray(o) ? o[0]?.score ?? 0 : o?.score ?? 0));
      items = items.map((c,k)=>({ ...c, rerankScore: probs[k] ?? undefined }))
                   .sort((a,b)=> (b.rerankScore ?? -1) - (a.rerankScore ?? -1));
      ndcg_rerank = ndcg(items.map(x=>x.rerankScore ?? 0));
      reranker.enabled = true;
    } catch (e:any) {
      reranker = { enabled:false, name:RERANK, error:e?.message || "reranker unavailable" };
    }

    return Response.json({
      enabled:true, backend:"node-wasm",
      embedder:{ name:EMBED, dim:qEmb.length, multilingual:/multi|e5/i.test(EMBED) },
      reranker, topk:TOPK, items,
      metrics:{ ndcg_embed, ...(ndcg_rerank!=null?{ndcg_rerank}:{}) },
      explain:[
        `Embed with <b>${EMBED}</b> (bi-encoder). <i>embedScore</i>=cosine similarity.`,
        reranker.enabled ? `Re-score Top-K with cross-encoder <b>${RERANK}</b>. <i>rerankScore</i>≈relevance.` : `Reranker disabled or unavailable.`,
      ],
    }, { headers:{ "cache-control":"no-store" }});
  } catch (e:any) {
    return Response.json({ enabled:false, error:"embedding error: "+(e?.message||String(e)) });
  }
}
