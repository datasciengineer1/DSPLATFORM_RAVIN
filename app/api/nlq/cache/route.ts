import { NextResponse } from "next/server";
import { readCache, upsertCache, writeCache, hashId, type CacheItem } from "@/lib/cache";
import { cosine, lexicalCosine } from "@/lib/hybrid";

const OLLAMA_URL   = process.env.OLLAMA_URL   || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const EMBED_SERVER = process.env.EMBED_SERVER || "http://127.0.0.1:7070";
const RERANK_SERVER= process.env.RERANK_SERVER|| "http://127.0.0.1:7070";

type Weights = { dense:number; sparse:number; cross:number };
type Detail = "short" | "standard" | "deep";

async function tryPostJSON(url:string, body:any, timeoutMs=20000){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:ctl.signal});
    const text=await r.text();
    try{ return { ok:r.ok, status:r.status, json:JSON.parse(text), text }; }
    catch{ return { ok:false, status:r.status, json:null as any, text }; }
  }catch(e:any){ return { ok:false, status:0, json:null as any, text:String(e?.message||e) }; }
  finally{ clearTimeout(t); }
}
async function embedIR(texts:string[]){ const r=await tryPostJSON(`${EMBED_SERVER}/embed`,{texts}); return r.ok?r.json:null; }
async function rerankIR(query:string,candidates:string[]){ const r=await tryPostJSON(`${RERANK_SERVER}/rerank`,{query,candidates}); return r.ok?(r.json?.scores||null):null; }
async function embedOllamaDense(texts:string[]){
  const out:number[][]=[]; for(const t of texts){
    const r=await tryPostJSON(`/api/ollama/embed`,{text:t},30000);
    if(!r.ok || !r.json?.ok || !Array.isArray(r.json?.dense?.[0])) return null;
    out.push(r.json.dense[0]);
  }
  return { dense: out, sparse: [], colbert: [] as number[][][] };
}
async function ollamaExplain(prompt:string){
  // Allow cold pulls / first token; keep model warm
  const r=await tryPostJSON(`${OLLAMA_URL}/api/generate`,{
    model: OLLAMA_MODEL, prompt, stream:false,
    options:{ temperature:0.2 },
    keep_alive: "5m"
  }, 120000);
  if(r.ok && r.json) return r.json?.response || r.json?.message?.content || "No response from Ollama.";
  return `Ollama not reachable (${r.text||r.status}). Start Ollama and pull a chat model (e.g., 'mistral').`;
}
function jaccard(a:string,b:string){ const A=new Set(a.toLowerCase().split(/\W+/).filter(Boolean)), B=new Set(b.toLowerCase().split(/\W+/).filter(Boolean)); const inter=[...A].filter(x=>B.has(x)).length, uni=new Set([...A,...B]).size||1; return inter/uni; }

function buildPrompt(nlq:string, detail:Detail){
  if (detail === "deep") {
    return `You are a senior data scientist. Answer the question below about a tabular business dataset.
Return your answer in **Markdown** with these exact section headings:

## What it means
## Why
## How to analyze
## Strategies
## Assumptions & limits
## Next best questions

Question:
"""${nlq}"""`;
  }
  if (detail === "standard") {
    return `Explain clearly in **Markdown** with sections:

## What it means
## Why (key drivers)
## How to analyze (brief)
## Strategies

Question:
"""${nlq}"""`;
  }
  return `Give a brief **Markdown** answer (3–5 sentences) and one next step.

Question:
"""${nlq}"""`;
}

export async function POST(req:Request){
  try{
    const { nlq, language="auto", weights={dense:0.5,sparse:0.3,cross:0.2} as Weights, forceFresh=false, provider="openai", detail="deep" as Detail } = await req.json();
    if(!nlq || typeof nlq!=="string") return NextResponse.json({ok:false,error:"Missing nlq"},{status:400});

    const items = readCache();
    const wsum=Math.max(1e-6,weights.dense+weights.sparse+weights.cross);
    const wd=weights.dense/wsum, ws=weights.sparse/wsum, wc=weights.cross/wsum;

    let mode:"ir"|"ollama-dense"|"stub"="stub";
    let qDense:number[]=[]; let qSparse:Record<string,number>={};
    let prelim:Array<{id:string;question:string;cosine:number;sparse:number;rerank:number;_it:any}>=[];

    if(provider!=="stub"){
      const qEmb=await embedIR([nlq]);
      if(qEmb){
        qDense=qEmb.dense?.[0]||[]; qSparse=qEmb.sparse?.[0]||{};
        prelim=items.map((it:any)=>{
          const cos=it.dense?.length?cosine(qDense,it.dense):0;
          const sp =it.sparse?lexicalCosine(qSparse,it.sparse):0;
          return {id:it.id,question:it.question,cosine:cos,sparse:sp,rerank:0,_it:it};
        }).sort((a,b)=>(b.cosine+b.sparse)-(a.cosine+a.sparse)).slice(0,8);
        const rer = prelim.length? await rerankIR(nlq,prelim.map(s=>s.question)) : null;
        if(rer) prelim.forEach((s,i)=>s.rerank=rer[i]??0);
        mode="ir";
      }
    }
    if(mode==="stub" && provider!=="stub"){
      const qEmb=await embedOllamaDense([nlq]);
      if(qEmb){
        qDense=qEmb.dense?.[0]||[];
        const need=items.filter((it:any)=>!it.dense||!it.dense.length).slice(0,64);
        if(need.length){
          const dens=await embedOllamaDense(need.map((n:any)=>n.question));
          if(dens){ need.forEach((it:any,idx:number)=>{ it.dense=dens.dense[idx]; }); writeCache(items); }
        }
        prelim=items.map((it:any)=>{
          const cos=it.dense?.length?cosine(qDense,it.dense):jaccard(nlq,it.question);
          return {id:it.id,question:it.question,cosine:cos,sparse:0,rerank:0,_it:it};
        }).sort((a,b)=>b.cosine-a.cosine).slice(0,8);
        mode="ollama-dense";
      }
    }
    if(mode==="stub"){
      prelim=items.map((it:any)=>{
        const jac=jaccard(nlq,it.question);
        return {id:it.id,question:it.question,cosine:jac,sparse:jac,rerank:0,_it:it};
      }).sort((a,b)=>b.cosine-a.cosine).slice(0,8);
    }

    const scored=prelim.map(s=>{
      const denseC=wd*(s.cosine||0), sparseC=(mode==="ir")?ws*(s.sparse||0):0, crossC=(mode==="ir")?wc*(s.rerank||0):0;
      return {...s, denseC, sparseC, crossC, combined:denseC+sparseC+crossC};
    }).sort((a,b)=>b.combined-a.combined);

    const top=scored[0]; const combinedTop=top?.combined??0;
    const cacheHitRule = mode==="ir" ? ((top?.cosine||0)>0.92 || (top?.rerank||0)>0.85 || combinedTop>0.80)
                       : mode==="ollama-dense" ? ((top?.cosine||0)>0.88 || combinedTop>0.70)
                       : ((top?.cosine||0)>0.65);
    const fromCache = !forceFresh && !!top && cacheHitRule;

    let explanation:string, matchId:string|undefined;
    if(fromCache){
      explanation = `Using cached explanation for similar question:\n“${top.question}”.\n(Use force fresh to regenerate.)`;
      matchId=top.id;
      if(detail==="deep"){
        explanation = await ollamaExplain(buildPrompt(nlq, detail));
        const rec:CacheItem={ id:hashId(nlq), question:nlq, lang:language, explanation, ts:new Date().toISOString(),
          dense:(mode!=="stub")?(qDense||[]):undefined, sparse:(mode==="ir")?(qSparse||{}):undefined, colbert:[] };
        upsertCache(rec); matchId=rec.id;
      }
    }else{
      explanation=await ollamaExplain(buildPrompt(nlq, detail));
      const rec:CacheItem={ id:hashId(nlq), question:nlq, lang:language, explanation, ts:new Date().toISOString(),
        dense:(mode!=="stub")?(qDense||[]):undefined, sparse:(mode==="ir")?(qSparse||{}):undefined, colbert:[] };
      upsertCache(rec); matchId=rec.id;
    }

    return NextResponse.json({
      ok:true, mode, fromCache, explanation, matchId,
      recommendedFollowups:["Drill down by top categories.","Show trend/seasonality strength.","Explain outliers and drivers."],
      retrieval:{
        combinedTop, weights, normWeights:{dense:wd,sparse:ws,cross:wc},
        formula:`score = ${wd.toFixed(2)}*cosine + ${ws.toFixed(2)}*sparse + ${wc.toFixed(2)}*cross`,
        hits: scored.slice(0,5).map(s=>({ id:s.id, question:s.question, cosine:s.cosine, sparse:s.sparse, rerank:s.rerank,
          contributions:{dense:s.denseC,sparse:s.sparseC,cross:s.crossC,combined:s.combined} }))
      },
      crossEncoderExplanation: mode==="ir" ? "Dense=semantic; Sparse=lexical; Cross=cross-encoder."
                               : mode==="ollama-dense" ? "Dense only via Ollama embeddings (bge-m3)." : "Stub lexical overlap."
    });
  }catch(err:any){
    console.error("NLQ route error:",err);
    return NextResponse.json({ok:false,error:String(err?.message||err)},{status:502});
  }
}
