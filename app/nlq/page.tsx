"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type RetrievalHit = { id:string; question:string; cosine:number; sparse:number; rerank:number; lang?:string; ts?:string };
type QueryResp = {
  fromCache:boolean;
  explanation:string;
  matchId?:string;
  retrieval:{ combinedTop:number; weights:{dense:number;sparse:number;cross:number}; hits:RetrievalHit[] };
  crossEncoderExplanation:string;
};

function Card({title,subtitle,children,right}:{title:string;subtitle?:string;children:React.ReactNode;right?:React.ReactNode}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-5 bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div><h3 className="text-base md:text-lg font-semibold">{title}</h3>{subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Button(props:any){return <button {...props} className={"px-3 py-1.5 text-sm rounded-md "+(props.className||"bg-blue-600 text-white hover:bg-blue-700")} />}

const LANGS = [
  {code:"auto", label:"Auto-detect"},
  {code:"en-US", label:"English (US)"},
  {code:"en-GB", label:"English (UK)"},
  {code:"es-ES", label:"Español"},
  {code:"fr-FR", label:"Français"},
  {code:"de-DE", label:"Deutsch"},
  {code:"hi-IN", label:"हिन्दी"},
  {code:"ja-JP", label:"日本語"},
  {code:"ko-KR", label:"한국어"},
  {code:"pt-BR", label:"Português (BR)"},
  {code:"zh-CN", label:"中文(简体)"}
];

export default function NLQPage(){
  const [nlq,setNlq]=useState("");
  const [lang,setLang]=useState("auto");
  const [provider,setProvider]=useState<"stub"|"openai"|"cohere"|"voyage">("stub");
  const [wDense,setWDense]=useState(0.5);
  const [wSparse,setWSparse]=useState(0.3);
  const [wCross,setWCross]=useState(0.2);
  const [res,setRes]=useState<QueryResp|null>(null);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState<string|null>(null);

  // Voice capture via Web Speech API
  const recRef = useRef<any>(null);
  const [listening,setListening]=useState(false);
  const [transcript,setTranscript]=useState("");

  useEffect(()=>{
    const SR:any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if(!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    if(lang!=="auto") rec.lang = lang;
    rec.onresult = (e:any)=>{
      let s=""; for(const r of e.results){ s += r[0].transcript; }
      setTranscript(s);
    };
    rec.onend = ()=> setListening(false);
    recRef.current = rec;
  },[lang]);

  function toggleRec(){
    const rec = recRef.current;
    if(!rec){ alert("This browser does not support speech recognition."); return; }
    if(listening){ rec.stop(); setListening(false); return; }
    setTranscript(""); setListening(true); rec.start();
  }

  async function ask(forceFresh=false){
    setBusy(true); setErr(null); setRes(null);
    try{
      const payload = { nlq: (nlq || transcript).trim(), language: lang, provider, weights:{dense:wDense,sparse:wSparse,cross:wCross}, forceFresh };
      const r = await fetch("/api/nlq/query",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j = await r.json();
      setRes(j);
    }catch(e:any){ setErr(e?.message||"Failed"); }
    setBusy(false);
  }

  async function deleteCacheForCurrent(){
    const q = (nlq || transcript).trim();
    if(!q) return;
    await fetch("/api/nlq/cache",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq:q })});
    alert("Cache deleted for this NLQ (if existed).");
  }

  const combinedOk = useMemo(()=> (wDense + wSparse + wCross) > 0.0001, [wDense,wSparse,wCross]);

  return (
    <main className="container mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">NLQ — Voice + Multilingual + Multi-vector</h1>
        <div className="flex gap-2">
          <Link href="/engineering" className="px-3 py-1.5 rounded-md border">← Engineering</Link>
          <Link href="/model" className="px-3 py-1.5 rounded-md border">Model Selection →</Link>
        </div>
      </div>

      <Card title="Ask a question" subtitle="Type or dictate your natural-language question about the dataset.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3">
            <textarea value={nlq} onChange={e=>setNlq(e.target.value)} placeholder="e.g., Forecast revenue for next 12 weeks by category"
              className="w-full min-h-[84px] rounded-md border p-2" />
            {transcript && <div className="mt-2 text-xs text-zinc-500">Transcript: <span className="font-mono">{transcript}</span></div>}
            <div className="mt-3 flex gap-2">
              <Button onClick={toggleRec} className={listening?"bg-red-600 text-white":"bg-zinc-900 text-white"}>{listening?"Stop":"🎙️ Voice"}</Button>
              <Button onClick={()=>ask(false)} disabled={!combinedOk || busy}>Ask</Button>
              <Button onClick={()=>ask(true)} className="bg-amber-600 text-white" disabled={!combinedOk || busy}>Ask (force fresh)</Button>
              <Button onClick={deleteCacheForCurrent} className="bg-transparent text-red-600 border border-red-600">Delete cache for this NLQ</Button>
            </div>
          </div>
          <div className="md:col-span-1 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-500">Language</span>
              <select value={lang} onChange={e=>setLang(e.target.value)} className="border rounded-md px-2 py-1.5">
                {LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-500">Embedding Provider</span>
              <select value={provider} onChange={e=>setProvider(e.target.value as any)} className="border rounded-md px-2 py-1.5">
                <option value="stub">Stub (local)</option>
                <option value="openai">OpenAI</option>
                <option value="cohere">Cohere</option>
                <option value="voyage">Voyage</option>
              </select>
            </label>
            <div className="grid gap-2">
              <span className="text-sm text-zinc-500">Multi-vector Weights</span>
              <div className="text-xs">Dense: {wDense.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.05" value={wDense} onChange={e=>setWDense(parseFloat(e.target.value))} />
              <div className="text-xs">Sparse: {wSparse.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.05" value={wSparse} onChange={e=>setWSparse(parseFloat(e.target.value))} />
              <div className="text-xs">Cross-enc: {wCross.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.05" value={wCross} onChange={e=>setWCross(parseFloat(e.target.value))} />
              <div className="text-xs text-zinc-500">Tip: weights do not need to sum to 1; they’re normalized server-side.</div>
            </div>
          </div>
        </div>
      </Card>

      {err && <div className="text-red-600 text-sm">{String(err)}</div>}

      {res && (
        <>
          <Card title="Answer" subtitle={res.fromCache ? "Retrieved from cache (similar question found)" : "Generated fresh (Ollama or fallback)"}
                right={<span className={"px-2 py-0.5 rounded text-xs "+(res.fromCache?"bg-emerald-100 text-emerald-700":"bg-sky-100 text-sky-700")}>{res.fromCache?"FROM CACHE":"NEW"}</span>}>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{res.explanation}</div>
          </Card>

          <Card title="Retrieval & Re-ranking Details" subtitle="Dense cosine • Sparse (overlap/BM25-like) • Cross-encoder re-rank score">
            <div className="text-sm text-zinc-600 mb-3">{res.crossEncoderExplanation}</div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left">
                  <th className="px-2 py-1">Candidate</th><th className="px-2 py-1">Cosine</th><th className="px-2 py-1">Sparse</th><th className="px-2 py-1">Cross</th>
                </tr></thead>
                <tbody>
                  {res.retrieval.hits.map((h,i)=>(
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{h.question}</td>
                      <td className="px-2 py-1">{h.cosine.toFixed(3)}</td>
                      <td className="px-2 py-1">{h.sparse.toFixed(3)}</td>
                      <td className="px-2 py-1">{h.rerank.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
