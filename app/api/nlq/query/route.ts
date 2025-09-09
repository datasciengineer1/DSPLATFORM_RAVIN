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
    const tx=await r.text(); try{ return {ok:r.ok,status:r.status,json:JSON.parse(tx),text:tx}; }catch{ return {ok:false,status:r.status,json:null as any,text:tx}; }
  }catch(e:any){ return {ok:false,status:0,json:null as any,text:String(e?.message||e)}; }
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
async function ollamaGenerate(prompt:string){
  const r=await tryPostJSON(`${OLLAMA_URL}/api/generate`,{
    model: OLLAMA_MODEL, prompt, stream:false,
    options:{ temperature:0.2, num_predict:900 },
    keep_alive:"5m"
  }, 120000);
  if(r.ok && r.json) return r.json?.response || r.json?.message?.content || "";
  return "";
}
function jaccard(a:string,b:string){ const A=new Set(a.toLowerCase().split(/\W+/).filter(Boolean)), B=new Set(b.toLowerCase().split(/\W+/).filter(Boolean)); const inter=[...A].filter(x=>B.has(x)).length, uni=new Set([...A,...B]).size||1; return inter/uni; }

function deepPrompt(nlq:string){ return `You are a senior data scientist. Answer the question below about a tabular business dataset.\nReturn the answer in **Markdown** with these exact section headings:\n\n## What it means\n## Why\n## How to analyze\n## Strategies\n## Assumptions & limits\n## Next best questions\n\nQuestion:\n"""${nlq}"""`; }
function standardFrom(md:string){ return `Condense the following Markdown explanation to ~150 words.\nKeep headings:\n## What it means\n## Why\n## How to analyze\n## Strategies\n\n---\n${md}`; }
function shortFrom(md:string){ return `Write a brief (3–5 sentences) Markdown summary and one next step based on the following:\n---\n${md}`; }

function ruleCondense(md:string, mode:Detail){
  const lines=(md||"").split(/\r?\n/); const sec:Record<string,string[]>= {}; let cur="";
  for(const ln of lines){ const m=ln.match(/^##\s+(.+?)\s*$/); if(m){cur=m[1].toLowerCase(); sec[cur]=[]; continue;} if(cur) sec[cur].push(ln); }
  const get=(k:string)=> (sec[k]?.join(" ")||"").replace(/\s+/g," ").trim();
  const pick=(txt:string,n=2)=> txt.split(/(?<=[.!?])\s+/).slice(0,n).join(" ");
  if(mode==="short"){
    const what=pick(get("what it means")||get("what"),2);
    const why =pick(get("why"),2);
    const how =pick(get("how to analyze")||get("how"),1);
    return `**Summary.** ${[what,why,how].filter(Boolean).join(" ")}\n\n**Next step.** Drill down by top categories or check seasonality.`;
  }else{
    const what=pick(get("what it means")||get("what"),2);
    const why =pick(get("why"),2);
    const how =pick(get("how to analyze")||get("how"),2);
    const strat=get("strategies");
    return `## What it means\n${what}\n\n## Why\n${why}\n\n## How to analyze\n${how}\n\n## Strategies\n${strat || "- Check drivers, outliers, and seasonality."}`;
  }
}

export async function POST(req:Request){
  try{
    const { nlq, language="auto", weights={dense:0.5,sparse:0.3,cross:0.2} as Weights, forceFresh=false, provider="openai", detail="deep" as Detail } = await req.json();
    if(!nlq || typeof nlq!=="string") return NextResponse.json({ok:false,error:"Missing nlq"},{status:400});

    const items=readCache(); const wsum=Math.max(1e-6,weights.dense+weights.sparse+weights.cross);
    const wd=weights.dense/wsum, ws=weights.sparse/wsum, wc=weights.cross/wsum;

    let mode:"ir"|"ollama-dense"|"stub"="stub"; let qDense:number[]=[]; let qSparse:Record<string,number>={};
    let prelim:Array<{id:string;question:string;cosine:number;sparse:number;rerank:number;_it:any}>=[];

    if(provider!=="stub"){
      const qEmb=await embedIR([nlq]);
      if(qEmb){
        qDense=qEmb.dense?.[0]||[]; qSparse=qEmb.sparse?.[0]||{};
        prelim=items.map((it:any)=>({id:it.id,question:it.question,
          cosine:it.dense?.length?cosine(qDense,it.dense):0,
          sparse:it.sparse?lexicalCosine(qSparse,it.sparse):0, rerank:0,_it:it}))
          .sort((a,b)=>(b.cosine+b.sparse)-(a.cosine+a.sparse)).slice(0,8);
        const rer=prelim.length? await rerankIR(nlq,prelim.map(s=>s.question)) : null;
        if(rer) prelim.forEach((s,i)=>s.rerank=rer[i]??0);
        mode="ir";
      }
    }
    if(mode==="stub" && provider!=="stub"){
      const qEmb=await embedOllamaDense([nlq]);
      if(qEmb){
        qDense=qEmb.dense?.[0]||[];
        const need=items.filter((it:any)=>!it.dense||!it.dense.length).slice(0,64);
        if(need.length){ const dens=await embedOllamaDense(need.map((n:any)=>n.question)); if(dens){ need.forEach((it:any,i:number)=>it.dense=dens.dense[i]); writeCache(items); } }
        prelim=items.map((it:any)=>({id:it.id,question:it.question,cosine:it.dense?.length?cosine(qDense,it.dense):jaccard(nlq,it.question),sparse:0,rerank:0,_it:it}))
          .sort((a,b)=>b.cosine-a.cosine).slice(0,8);
        mode="ollama-dense";
      }
    }
    if(mode==="stub"){
      prelim=items.map((it:any)=>({id:it.id,question:it.question,cosine:jaccard(nlq,it.question),sparse:jaccard(nlq,it.question),rerank:0,_it:it}))
        .sort((a,b)=>b.cosine-a.cosine).slice(0,8);
    }

    const scored=prelim.map(s=>{
      const denseC=wd*(s.cosine||0), sparseC=(mode==="ir")?ws*(s.sparse||0):0, crossC=(mode==="ir")?wc*(s.rerank||0):0;
      return {...s, denseC, sparseC, crossC, combined:denseC+sparseC+crossC};
    }).sort((a,b)=>b.combined-a.combined);

    const top=scored[0]; const combinedTop=top?.combined??0;
    const cacheHitRule = mode==="ir" ? ((top?.cosine||0)>0.92 || (top?.rerank||0)>0.85 || combinedTop>0.80)
                       : mode==="ollama-dense" ? ((top?.cosine||0)>0.88 || combinedTop>0.70)
                       : ((top?.cosine||0)>0.65);
    const fromCacheBase = !forceFresh && !!top && cacheHitRule;

    // 1) always (re)build a deep explanation (from cache or fresh)
    let deepMd = "";
    if(fromCacheBase){
      // if cached, try to reuse the cached deep explanation
      const hit = readCache().find((x:any)=>x.id===top.id);
      if(hit?.explanation) deepMd = hit.explanation;
    }
    if(!deepMd){ deepMd = await ollamaGenerate(deepPrompt(nlq)) || ""; }

    if(!deepMd || deepMd.length < 200){
      // retrieval-based fallback for deep
      const list = scored.slice(0,3).map((s,i)=>`- ${i+1}. “${s.question}” (cos=${(s.cosine||0).toFixed(2)}, sparse=${(s.sparse||0).toFixed(2)}, cross=${(s.rerank||0).toFixed(2)})`).join("\n");
      deepMd = `## What it means\nWe generated a preliminary explanation from similar questions.\n\n## Why\n${list}\n\n## How to analyze\n- Validate columns and drivers.\n- Plot seasonality and outliers.\n\n## Strategies\n- Control costs / optimize mix; add seasonal components for forecasting.\n\n## Assumptions & limits\nHeuristic fallback used.\n\n## Next best questions\n- Drill down by top categories.\n- Show seasonality strength.\n- Explain outliers and drivers.`;
    }

    deepMd = ensureImpactTable(deepMd, nlq);

    // 2) Condense if needed
    let finalMd = deepMd;
    if((["standard","short"] as Detail[]).includes(detail)){
      const prompt = detail==="standard" ? standardFrom(deepMd) : shortFrom(deepMd);
      const llm = await ollamaGenerate(prompt);
      finalMd = llm && llm.length>80 ? llm : ruleCondense(deepMd, detail);
    }

    const rec:CacheItem = {
      id: hashId(nlq), question:nlq, lang:language, explanation: deepMd,
      ts: new Date().toISOString(),
      dense:(mode!=="stub")? (qDense||[]): undefined,
      sparse:(mode==="ir")? (qSparse||{}): undefined,
      colbert:[]
    };
    upsertCache(rec);

    return NextResponse.json({
      ok:true, mode, fromCache:fromCacheBase, explanation: finalMd, matchId: rec.id,
      recommendedFollowups:["Drill down by top categories.","Show trend/seasonality strength.","Explain outliers and drivers."],
      retrieval:{
        combinedTop, weights, normWeights:{dense:wd,sparse:ws,cross:wc},
        formula:`score = ${wd.toFixed(2)}*cosine + ${ws.toFixed(2)}*sparse + ${wc.toFixed(2)}*cross`,
        hits: scored.slice(0,7).map(s=>({ id:s.id, question:s.question, cosine:s.cosine, sparse:s.sparse, rerank:s.rerank,
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

// ---- Repair step: ensure "KPI impact (structured)" exists ----
function ensureImpactTable(md: string, nlq: string): string {
  try {
    // If a KPI table already exists, keep as-is
    if (/\|\s*KPI\s*\|\s*Direction/i.test(md)) return md;

    const text = md || "";
    const kpis = [
      "profit margin", "margin", "revenue", "cogs", "cost of goods sold",
      "churn", "conversion", "units", "arpu"
    ];

    type Row = { kpi:string; dir:"up"|"down"|"flat"; mag:"low"|"med"|"high"; why:string };
    const rows: Row[] = [];

    const dirOf = (s:string): "up"|"down"|"flat" => {
      const t = s.toLowerCase();
      if (/(increase|increasing|up|rise|rising|higher|growth|improv)/.test(t)) return "up";
      if (/(decrease|decreasing|down|fall|lower|drop|declin)/.test(t)) return "down";
      return "flat";
    };
    const magOf = (s:string): "low"|"med"|"high" => {
      const t = s.toLowerCase();
      if (/(significant|substantial|large|strong|sharp|high)/.test(t)) return "high";
      if (/(slight|small|minor|low|modest)/.test(t)) return "low";
      return "med";
    };

    for (const k of kpis) {
      const safe = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`([\\s\\S]{0,160})${safe}([\\s\\S]{0,160})`, "i");
      const m = text.match(re);
      if (m) {
        const seg = (m[1] + k + m[2]);
        const dir = dirOf(seg);
        const mag = magOf(seg);
        const whyMatch = seg.match(/(?:because|due to|driven by|as (?:a )?result of|from)\s+([^.;:]+)[.;:]?/i);
        const why = whyMatch ? whyMatch[0].trim() : "";
        rows.push({ kpi:k, dir, mag, why });
      }
    }

    // Fallback rows if nothing detected
    const uniq = (list: Row[]) => {
      const seen = new Set<string>(); const out: Row[] = [];
      for (const r of list) {
        const key = r.kpi.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) continue; seen.add(key); out.push(r);
      }
      return out;
    };

    const finalRows = uniq(rows).slice(0, 6);
    const lines = finalRows.length
      ? finalRows.map(r => `| ${titleCase(r.kpi)} | ${r.dir} | ${r.mag} | ${r.why || "—"} |`).join("\n")
      : [
          "| Profit margin | flat | low | Not enough signal yet. |",
          "| Revenue | flat | low | Pending analysis. |",
          "| COGS | flat | low | Pending analysis. |",
        ].join("\n");

    const table = `### KPI impact (structured)
| KPI | Direction (up/down/flat) | Magnitude (low/med/high) | Why |
|---|---|---|---|
${lines}

`;
    return table + md;
  } catch {
    return md;
  }

  function titleCase(s:string){ return s.replace(/\b\w/g, c => c.toUpperCase()); }
}
