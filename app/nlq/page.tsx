"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SparkBars from "@/components/SparkBars";
import InfoTip from "@/components/InfoTip";
import Spinner from "@/components/Spinner";
import VoiceButton from "@/components/VoiceButton";
import TabStrip from "@/components/TabStrip";
import TldrSummary from "@/components/TldrSummary";
import ImpactChips from "@/components/ImpactChips";
import HitList from "@/components/HitList";
import VoiceLoop from "@/components/VoiceLoop";
import ResultSkeleton from "@/components/ResultSkeleton";

type RetrievalHit = {
  id:string; question:string; cosine:number; sparse:number; rerank:number;
  contributions?: { dense:number; sparse:number; cross:number; combined:number };
};
type QueryResp = {
  ok?:boolean; mode?: "ir" | "ollama-dense" | "stub"; fromCache:boolean;
  explanation:string; matchId?:string;
  recommendedFollowups?: string[];
  retrieval:{ combinedTop:number; weights:{dense:number;sparse:number;cross:number}; normWeights?:{dense:number;sparse:number;cross:number}; formula?:string; hits:RetrievalHit[]; };
  crossEncoderExplanation:string; error?:string;
};

function Card({title,subtitle,children,right}:{title:React.ReactNode;subtitle?:string;children:React.ReactNode;right?:React.ReactNode}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-5 bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Button({children, className="", ...rest}: any){
  return (
    <button
      {...rest}
      title={rest?.title || (typeof children==="string" ? children : undefined)}
      className={
        "inline-flex items-center justify-center gap-2 min-w-[96px] whitespace-nowrap font-medium px-3 py-1.5 text-sm rounded-md " +
        (className || "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60")
      }
    >
      {children}
    </button>
  );
}

const LANGS=[
  {code:"auto",label:"Auto-detect"},
  {code:"en-US",label:"English (US)"},
  {code:"hi-IN",label:"हिन्दी"},
  {code:"es-ES",label:"Español"},
  {code:"fr-FR",label:"Français"},
  {code:"de-DE",label:"Deutsch"},
  {code:"ja-JP",label:"日本語"},
  {code:"ko-KR",label:"한국어"},
  {code:"pt-BR",label:"Português (BR)"},
  {code:"ru-RU",label:"Русский"},
  {code:"zh-CN",label:"中文(简体)"},
];
function detectLangFromText(s:string){
  const tests=[
    {re:/[\u0900-\u097F]/,code:"hi-IN"},
    {re:/[\u4E00-\u9FFF]/,code:"zh-CN"},
    {re:/[\u3040-\u30FF]/,code:"ja-JP"},
    {re:/[\uAC00-\uD7A3]/,code:"ko-KR"},
    {re:/[\u0400-\u04FF]/,code:"ru-RU"},
    {re:/[áéíóúñ¿¡]/i,code:"es-ES"},
    {re:/[àâçéèêëîïôùûü]/i,code:"fr-FR"},
    {re:/[äöüß]/i,code:"de-DE"},
    {re:/[ãõç]/i,code:"pt-BR"},
  ];
  for(const t of tests) if(t.re.test(s)) return t.code;
  return "en-US";
}
function extractTLDR(md:string){
  const lines=(md||"").split(/\r?\n/); let cur=""; const out:Record<string,string[]>= {};
  for(const ln of lines){
    const m=ln.match(/^##\s+(.+?)\s*$/); if(m){cur=m[1].toLowerCase(); out[cur]=[]; continue;}
    if(cur) out[cur].push(ln);
  }
  const norm=(k:string)=> (out[k]?.join(" ")||"").replace(/\s+/g," ").trim();
  const pick=(txt:string)=> txt.split(/(?<=[.!?])\s+/).slice(0,2).join(" ");
  return {
    what: pick(norm("what it means")||norm("what")),
    why : pick(norm("why")),
    how : pick(norm("how to analyze")||norm("how")),
  };
}

export default function NLQPage(){
  const router = useRouter();

  // Health
  const [irUp,setIrUp]=useState(false);
  const [ollamaUp,setOllamaUp]=useState(false);
  type Provider="stub"|"ollama-dense"|"openai"|"cohere"|"voyage";
  const [provider,setProvider]=useState<Provider>("openai");
  const [fallbackMsg,setFallbackMsg]=useState("");

  // UI state
  const [nlq,setNlq]=useState("");
  const [lang,setLang]=useState("auto");
  const [detail,setDetail]=useState<"short"|"standard"|"deep">("deep");
  const [wDense,setWDense]=useState(0.5);
  const [wSparse,setWSparse]=useState(0.3);
  const [wCross,setWCross]=useState(0.2);
  const [autoContinue,setAutoContinue]=useState<boolean>(true);
  const [autoFallback,setAutoFallback]=useState<boolean>(true);
  const [interactive,setInteractive]=useState<boolean>(false);

  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const [res,setRes]=useState<QueryResp|null>(null);

  // Persist a couple of toggles
  useEffect(()=>{ try{
    const v1=localStorage.getItem("nlq:auto-continue"); if(v1!==null) setAutoContinue(v1!=="0");
    const v2=localStorage.getItem("nlq:auto-fallback"); if(v2!==null) setAutoFallback(v2!=="0");
  }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem("nlq:auto-continue", autoContinue?"1":"0"); }catch{} },[autoContinue]);
  useEffect(()=>{ try{ localStorage.setItem("nlq:auto-fallback", autoFallback?"1":"0"); }catch{} },[autoFallback]);

  // Health probe → provider
  useEffect(()=>{(async()=>{
    try{
      const j=await (await fetch("/api/health")).json();
      setIrUp(!!j.irUp); setOllamaUp(!!j.ollamaUp);
      if(autoFallback){
        if(!j.irUp && j.ollamaUp){ setProvider("ollama-dense"); setFallbackMsg("IR offline → using Ollama (dense-only)."); }
        else if(!j.irUp && !j.ollamaUp){ setProvider("stub"); setFallbackMsg("IR & Ollama offline → using Stub (local)."); }
        else setFallbackMsg("");
      }
    }catch{
      if(autoFallback){ setProvider("stub"); setFallbackMsg("Health check failed → using Stub (local)."); }
    }
  })();},[autoFallback]);

  // Ask
  async function ask(forceFresh=false){
    setBusy(true); setErr(null);
    try{
      const q = nlq.trim(); if(!q){ setErr("Please type a question."); setBusy(false); return; }
      let effective:Provider = provider;
      if(autoFallback){ if(!irUp && ollamaUp) effective="ollama-dense"; else if(!irUp && !ollamaUp) effective="stub"; }
      const chosenLang = lang==="auto" ? detectLangFromText(q) : lang;

      const payload = { nlq:q, language:chosenLang, provider:effective,
        weights:{dense:wDense,sparse:wSparse,cross:wCross}, forceFresh, detail };

      const r = await fetch("/api/nlq/query",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const text=await r.text(); let j:QueryResp|null=null;
      try { j = JSON.parse(text);} catch { setErr(`NLQ API returned a non-JSON response:\n${text.slice(0,240)}`); setBusy(false); return; }
      if(j?.ok===false && j?.error) setErr(j.error);
      setRes(j || null);

      if(autoContinue){ const p=new URLSearchParams({ nlq:q, auto:"1" }).toString(); router.push(`/model?${p}`); }
    }catch(e:any){
      setErr(String(e?.message||e));
    }
    setBusy(false);
  }

  // Derived
  const combinedOk = (wDense+wSparse+wCross)>0.0001;
  const speechLang = useMemo(()=> lang==="auto" ? detectLangFromText(nlq) : lang, [lang,nlq]);
  const [tab,setTab]=useState<"Explanation"|"Retrieval"|"Raw">("Explanation");
  const [rview,setRview]=useState<"Compact"|"Table">("Compact");
  const tldr = useMemo(()=> extractTLDR(res?.explanation || ""), [res?.explanation]);
  const speakText = useMemo(() => {
  const confidence = useMemo(() => { const v = res?.retrieval?.combinedTop ?? 0; if (v >= 0.75) return {label:"High", cls:"bg-emerald-500\/15 text-emerald-400 border border-emerald-500\/20"}; if (v >= 0.5) return {label:"Medium", cls:"bg-amber-500\/15 text-amber-400 border border-amber-500\/20"}; return {label:"Low", cls:"bg-zinc-500\/15 text-zinc-400 border border-zinc-500\/20"}; }, [res?.retrieval?.combinedTop]);    const parts = [tldr.what, tldr.why].filter(Boolean);
    return parts.length ? parts.join(". ") : "";
  }, [tldr.what, tldr.why]);

  return (
    <main className="container mx-auto px-4 py-5 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">NLQ — Workspace</h1>
        <nav className="flex gap-2">
          <Link href="/engineering" className="px-3 py-1.5 rounded-md border">← Engineering</Link>
          <Link href="/model" className="px-3 py-1.5 rounded-md border">Model Selection →</Link>
        </nav>
      </header>

      {fallbackMsg && <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{fallbackMsg}</div>}

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card title="Recommended follow-ups" subtitle="Click to re-ask with context">
            <div className="flex flex-col gap-2">
              {(res?.recommendedFollowups||["Drill down by top categories.","Show trend/seasonality strength.","Explain outliers and drivers."]).map((q,i)=>(
                <button key={i} className="text-left rounded-md border px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 disabled:opacity-50"
                  onClick={()=>{ setNlq(q); setTimeout(()=>ask(false),10); }} disabled={busy}>{q}</button>
              ))}
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-3">Retrieval summary <TabStrip tabs={["Compact","Table"]} value={rview} onChange={v=>setRview(v as any)} /></span>}>
            {res ? (
              rview==="Compact" ? (
                <HitList hits={res.retrieval.hits as any} />
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="text-left"><th className="px-2 py-1">Candidate</th><th className="px-2 py-1">Cos</th><th className="px-2 py-1">Sparse</th><th className="px-2 py-1">Cross</th><th className="px-2 py-1">Combined</th></tr></thead>
                    <tbody>
                      {res.retrieval.hits.map((h,i)=>(
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{h.question}</td>
                          <td className="px-2 py-1">{(h.contributions?.dense ?? h.cosine).toFixed(3)}</td>
                          <td className="px-2 py-1">{(h.contributions?.sparse ?? h.sparse).toFixed(3)}</td>
                          <td className="px-2 py-1">{(h.contributions?.cross  ?? h.rerank).toFixed(3)}</td>
                          <td className="px-2 py-1">{(h.contributions?.combined ?? 0).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : <div className="text-sm text-zinc-500">Ask a question to see retrieval details.</div>}
          </Card>
        </aside>

        {/* CENTER */}
        <section className="col-span-12 lg:col-span-6 space-y-4">
          <Card title="Ask a question" subtitle="Type or dictate your question, pick language & detail; click Ask.">
            <div className="flex flex-col gap-3">
              <textarea
                value={nlq} onChange={e=>setNlq(e.target.value)} disabled={busy}
                placeholder="e.g., Forecast revenue for next 12 weeks by category"
                className="w-full min-h-[96px] rounded-md border p-2"
              />
              <div className="flex flex-wrap items-center gap-2">
                <VoiceButton lang={useMemo(()=> lang==="auto" ? detectLangFromText(nlq) : lang,[lang,nlq])} onResult={t=>setNlq(t)} />
                <Button onClick={()=>ask(false)} disabled={!combinedOk || busy}>
                  {busy ? <><Spinner size={14}/> Asking…</> : "Ask"}
                </Button>
                <Button onClick={()=>ask(true)} className="bg-amber-600 text-white" disabled={!combinedOk || busy}>
                  {busy ? <><Spinner size={14}/> Forcing fresh…</> : "Ask (force fresh)"}
                </Button>

                {/* colored chips */}
                <div className="hidden md:flex items-center gap-3 ml-3 text-xs">
                  <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-2 rounded bg-sky-500" /> <span className="text-sky-400">Dense {wDense.toFixed(2)}</span></span>
                  <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-2 rounded bg-violet-500" /> <span className="text-violet-400">Sparse {wSparse.toFixed(2)}</span></span>
                  <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-2 rounded bg-emerald-500" /> <span className="text-emerald-400">Cross {wCross.toFixed(2)}</span></span>
                </div>

                <label className="ml-2 text-sm inline-flex items-center gap-2">
                  <input type="checkbox" checked={autoContinue} onChange={e=>setAutoContinue(e.target.checked)} disabled={busy} /> Auto-continue
                </label>
                <label className="ml-2 text-sm inline-flex items-center gap-2">
                  <input type="checkbox" checked={autoFallback} onChange={e=>setAutoFallback(e.target.checked)} disabled={busy} /> Auto-fallback
                </label>
                <label className="ml-2 text-sm inline-flex items-center gap-2">
                  <input type="checkbox" checked={interactive} onChange={e=>setInteractive(e.target.checked)} disabled={busy} /> Interactive mode (beta)
                </label>
              </div>
              {err && <div className="text-red-600 text-sm whitespace-pre-wrap">{String(err)}</div>}
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-3">Results {res ? <span className={"px-2 py-0.5 rounded-full text-xs "+confidence.cls}>{confidence.label} confidence</span> : null} <TabStrip tabs={["Explanation","Retrieval","Raw"]} value={tab} onChange={v=>setTab(v as any)} /></span>}
            subtitle={tab==="Explanation" ? "Structured Markdown answer" : tab==="Retrieval" ? "Top candidates & scores" : "Raw API (debug)"}
          >
            {tab==="Explanation" && (
              res
                ? <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert">
                    {busy ? <ResultSkeleton lines={10} /> : <TldrSummary markdown={res.explanation} className="not-prose" />}
                    {!busy && <ReactMarkdown remarkPlugins={[remarkGfm]}>{res.explanation || ""}</ReactMarkdown>}
                    <VoiceLoop enabled={interactive && !busy} speakText={(!busy && (extractTLDR(res.explanation).what || "")) || ""} onFinal={(t)=>{ setNlq(t); ask(false); }} />
                  </div>
                : <div className="text-sm text-zinc-500">Ask a question to see an explanation.</div>
            )}
            {tab==="Retrieval" && (
              res
                ? <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead><tr className="text-left"><th className="px-2 py-1">Candidate</th><th className="px-2 py-1">Cos</th><th className="px-2 py-1">Sparse</th><th className="px-2 py-1">Cross</th><th className="px-2 py-1">Combined</th></tr></thead>
                      <tbody>
                        {res.retrieval.hits.map((h,i)=>(
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{h.question}</td>
                            <td className="px-2 py-1">{(h.contributions?.dense ?? h.cosine).toFixed(3)}</td>
                            <td className="px-2 py-1">{(h.contributions?.sparse ?? h.sparse).toFixed(3)}</td>
                            <td className="px-2 py-1">{(h.contributions?.cross  ?? h.rerank).toFixed(3)}</td>
                            <td className="px-2 py-1">{(h.contributions?.combined ?? 0).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                : <div className="text-sm text-zinc-500">No retrieval yet.</div>
            )}
            {tab==="Raw" && (
              <pre className="text-xs overflow-auto max-h-[420px]">{res ? JSON.stringify(res,null,2) : "Ask to see raw API response."}</pre>
            )}
          </Card>
        </section>

        {/* RIGHT */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card title="Language">
            <select value={lang} onChange={e=>setLang(e.target.value)} className="border rounded-md px-2 py-1.5 w-full" disabled={busy}>
              {LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </Card>

          <Card title="Detail level" subtitle="Controls explanation depth.">
            <select value={detail} onChange={e=>setDetail(e.target.value as any)} className="border rounded-md px-2 py-1.5 w-full" disabled={busy}>
              <option value="short">Short</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
            <p className="text-xs text-zinc-500 mt-2">“Deep” adds <i>Why / What / How / Strategies / Assumptions / Next questions</i>.</p>
          </Card>

          <Card title="Embedding Provider" subtitle={irUp ? "IR online: dense+sparse+cross available." : (ollamaUp ? "IR offline: Ollama dense-only." : "IR & Ollama offline: stub only.")}>
            <select value={provider} onChange={e=>setProvider(e.target.value as any)} className="border rounded-md px-2 py-1.5 w-full" disabled={busy}>
              <option value="openai" disabled={!irUp && autoFallback}>Cohere/OpenAI/Voyage (IR required)</option>
              <option value="ollama-dense" disabled={!ollamaUp && autoFallback}>Ollama (dense-only)</option>
              <option value="stub">Stub (local)</option>
            </select>
          </Card>

          <Card
            title="Multi-vector Weights"
            right={<InfoTip title="How weights work">
              <div>
                We combine three signals:
                <ul className="list-disc ml-4 mt-1">
                  <li><b>Dense (semantic)</b> – meaning similarity.</li>
                  <li><b>Sparse (lexical)</b> – exact token/phrase matches.</li>
                  <li><b>Cross-encoder</b> – precise re-ranking of the top hits.</li>
                </ul>
                Score = <code>w<sub>d</sub>·cos + w<sub>s</sub>·sparse + w<sub>c</sub>·cross</code>.
              </div>
            </InfoTip>}
          >
            <div className="grid gap-2">
              <div className="text-xs flex items-center justify-between">
                <span>Dense: {wDense.toFixed(2)}</span>
                <span className="text-sky-400">semantic</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={wDense} onChange={e=>setWDense(parseFloat(e.target.value))} disabled={busy} />

              <div className="text-xs flex items-center justify-between">
                <span>Sparse: {wSparse.toFixed(2)}</span>
                <span className="text-violet-400">lexical</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={wSparse} onChange={e=>setWSparse(parseFloat(e.target.value))} disabled={!irUp || busy} />

              <div className="text-xs flex items-center justify-between">
                <span>Cross-enc: {wCross.toFixed(2)}</span>
                <span className="text-emerald-400">rerank</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={wCross} onChange={e=>setWCross(parseFloat(e.target.value))} disabled={!irUp || busy} />
              <span className="text-xs text-zinc-500">Tip: Dense≈0.6, Sparse≈0.3 for ID-heavy; add Cross≈0.2 to improve precision.</span>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
