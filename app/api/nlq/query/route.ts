import { NextResponse } from "next/server";
import { embedStub, searchSimilar } from "@/lib/nlq";
import { putCache } from "@/lib/cache";
import { explainCrossEncoder } from "@/lib/crossEncoder";

async function ollamaExplain(prompt:string){
  try{
    const url = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
    const model = process.env.OLLAMA_MODEL || "llama3";
    const body = { model, prompt, stream:false, options:{ temperature:0.2 } };
    const r = await fetch(url,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    // different servers shape responses as {response:""} or {message:{content:""}}
    return j?.response || j?.message?.content || "No response from Ollama.";
  }catch(e:any){
    return `Ollama not reachable. (Set OLLAMA_URL/OLLAMA_MODEL). Fallback explanation:\n\nBased on your question, we would analyze the dataset, run the selected model, and summarize key drivers and uncertainties.`;
  }
}

export async function POST(req:Request){
  const { nlq, language="auto", provider="stub", weights={dense:0.5,sparse:0.3,cross:0.2}, forceFresh=false } = await req.json();
  if(!nlq || typeof nlq!=="string") return NextResponse.json({ error:"Missing nlq" },{status:400});

  // embed (stub; swap with real provider later)
  const qvec = embedStub(nlq);

  // retrieve from cache (multi-vector + cross-encoder proxy)
  const { hits, top } = searchSimilar(nlq, qvec, weights);
  const topHit = hits[0];
  const fromCache = !forceFresh && topHit && ( topHit.cosine>0.92 || topHit.rerank>0.85 || (top>0.8) );

  let explanation:string, matchId:string|undefined;
  if(fromCache){
    // we do not re-read the body to keep it light; simply signal cache path
    explanation = `Using cached explanation for similar question:\n“${topHit.question}”\n\n(You can force regenerate from Ollama or delete cache.)`;
    matchId = topHit.id;
  }else{
    explanation = await ollamaExplain(nlq);
    // store in cache (including vector)
    matchId = putCache(nlq, language, qvec, explanation);
  }

  const crossEncoderExplanation = explainCrossEncoder();

  return NextResponse.json({
    fromCache,
    explanation,
    matchId,
    retrieval: { combinedTop: top, weights, hits },
    crossEncoderExplanation
  });
}
