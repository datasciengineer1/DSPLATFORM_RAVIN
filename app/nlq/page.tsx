"use client";
import { expandStructToMarkdown } from "@/app/lib/explain_narrative";
import ExplainTLDR from "@/components/ExplainTLDR";
import ExplainSections from "@/components/ExplainSections";
import ExplainHeader from "@/components/ExplainHeader";
import CompactRetrieval from "@/components/CompactRetrieval";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import KpiImpactTable from "@/components/KpiImpactTable";
import WeightsPanel from "@/components/WeightsPanel";
import VoiceButton from "@/components/VoiceButton";

type RetrievalHit = { id?:string; question:string; cosine?:number; sparse?:number; rerank?:number; combined?:number };
type Retrieval = { hits: RetrievalHit[]; weights?:{dense:number;sparse:number;cross:number} };

type Result = {
  ok?: boolean;
  explanation?: string;               // markdown
  explainStruct?: { kpi_impact?: any[] };
  retrieval?: Retrieval;
  provider?: string;
  error?: string;
};

function stripKpiSection(md: string){ try{ return (md||"").replace(/^###\s*KPI impact.*?(?=^##\s+|\Z)/gms,"").trim(); }catch{return md||""} }

function RetrievalTable({r}:{r?:Retrieval}){
  const w = r?.weights || {dense:0.5,sparse:0.3,cross:0.2};
  const rows = r?.hits?.length ? r.hits.slice(0,8) : [];
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="text-sm font-semibold mb-1">Retrieval summary</div>
      <div className="text-xs text-zinc-500 mb-2">Normalized weights: dense {w.dense.toFixed(2)}, sparse {w.sparse.toFixed(2)}, cross {w.cross.toFixed(2)}</div>
      {rows.length ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/40 dark:bg-zinc-900/30">
              <tr className="text-left">
                <th className="px-2 py-1">Candidate</th>
                <th className="px-2 py-1">Cos</th>
                <th className="px-2 py-1">Sparse</th>
                <th className="px-2 py-1">Cross</th>
                <th className="px-2 py-1">Combined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h,i)=>(
                <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-2 py-1 text-xs">{h.question}</td>
                  <td className="px-2 py-1">{h.cosine?.toFixed?.(3) ?? "—"}</td>
                  <td className="px-2 py-1">{h.sparse?.toFixed?.(3) ?? "—"}</td>
                  <td className="px-2 py-1">{h.rerank?.toFixed?.(3) ?? "—"}</td>
                  <td className="px-2 py-1">{h.combined?.toFixed?.(3) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-xs text-zinc-500">No retrieval candidates yet. Ask a question to populate.</div>}
    </div>
  );
}

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

export default function NLQPage(){
  const router = useRouter();

  // UI state
  const [nlq,setNlq]=useState("");
  const [detail,setDetail]=useState<"short"|"standard"|"deep">("deep");
  const [provider,setProvider]=useState<string>("Cohere (IR required)");
  const [wDense,setWDense]=useState(0.5);
  const [wSparse,setWSparse]=useState(0.3);
  const [wCross,setWCross]=useState(0.2);
  const [busy,setBusy]=useState(false);
  const [res,setRes]=useState<Result|null>(null);
  const [error,setError]=useState<string>("");

  const narrativeMd = React.useMemo(()=> res?.explainStruct ? expandStructToMarkdown(res.explainStruct as any, detail) : "", [res?.explainStruct, detail]);

  // Returned features you asked to keep
  const [autoContinue,setAutoContinue]=useState(true);
  const [autoFallback,setAutoFallback]=useState(true);
  const [interactive,setInteractive]=useState(false);

  // hydrate from storage
  useEffect(()=>{
    try{
      const last = sessionStorage.getItem("nlq:last") || "";
      if(last) setNlq(last);
      const s = sessionStorage.getItem("nlq:last_explain_struct"); if (s) setRes(r=>({...r, explainStruct: JSON.parse(s)} as Result));
      const m = sessionStorage.getItem("nlq:last_explain_md"); if (m) setRes(r=>({...r, explanation: m} as Result));
    }catch{}
    try{
      const ac = localStorage.getItem("nlq:auto-continue"); if (ac!==null) setAutoContinue(ac!=="0");
      const af = localStorage.getItem("nlq:auto-fallback"); if (af!==null) setAutoFallback(af!=="0");
    }catch{}
  },[]);
  useEffect(()=>{ try{ sessionStorage.setItem("nlq:last", nlq); }catch{} },[nlq]);
  useEffect(()=>{ try{ localStorage.setItem("nlq:auto-continue", autoContinue?"1":"0"); }catch{} },[autoContinue]);
  useEffect(()=>{ try{ localStorage.setItem("nlq:auto-fallback", autoFallback?"1":"0"); }catch{} },[autoFallback]);

  async function ask(forceFresh=false){
    setBusy(true); setError("");
    try{
      const r = await fetch("/api/nlq/query", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          nlq, forceFresh, detail, provider,
          weights: { dense:wDense, sparse:wSparse, cross:wCross }
        })
      });
      const j:Result = await r.json().catch(()=>({ ok:false, error:"NON_JSON"}));
      try{
        if (j?.explainStruct) sessionStorage.setItem("nlq:last_explain_struct", JSON.stringify(j.explainStruct));
        if (j?.explanation)   sessionStorage.setItem("nlq:last_explain_md", j.explanation);
      }catch{}
      setRes(j || null);

      // auto-fallback to local stub if IR path failed
      if (!j?.ok && autoFallback && provider!=="Stub (local)"){
        setProvider("Stub (local)");
        setTimeout(()=>ask(forceFresh), 0);
        return;
      }

      // auto-continue to Model Selection
      if (j?.ok && autoContinue){
        const p = new URLSearchParams({ nlq }).toString();
        router.push(`/model?${p}`);
      }
    }catch(e:any){
      setError(String(e?.message||e));
    }finally{ setBusy(false); }
  }

  const hasKpi = !!res?.explainStruct?.kpi_impact?.length;

  return (
    <main className="container mx-auto px-4 py-5 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">NLQ — Workspace</h1>
        <nav className="flex gap-2">
          <Link href="/model" className="px-3 py-1.5 rounded-md border">Model Selection →</Link>
        </nav>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card title="Recommended follow-ups">
            <div className="flex flex-col gap-2">
              <button onClick={()=>setNlq("Drill down by top categories.")} className="px-3 py-1.5 rounded-md border text-left">Drill down by top categories.</button>
              <button onClick={()=>setNlq("Show trend/seasonality strength.")} className="px-3 py-1.5 rounded-md border text-left">Show trend/seasonality strength.</button>
              <button onClick={()=>setNlq("Explain outliers and drivers.")} className="px-3 py-1.5 rounded-md border text-left">Explain outliers and drivers.</button>
            </div>
          </Card>
          <CompactRetrieval r={res?.retrieval} />
        </aside>

        {/* CENTER */}
        <section className="col-span-12 lg:col-span-6 space-y-4">
          <Card
            title="Ask a question"
            subtitle="Type or dictate your question, pick detail; click Ask."
            right={<div className="text-xs text-zinc-500">{interactive ? "Interactive mode (beta)" : ""}</div>}
          >
            <textarea value={nlq} onChange={e=>setNlq(e.target.value)} placeholder="e.g., Forecast revenue for next 12 weeks by category"
              className="w-full min-h-[120px] rounded-md border p-2" />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <VoiceButton onFinal={(t)=>setNlq(t)} disabled={busy} />
              <button disabled={busy} onClick={()=>ask(false)} className={`px-3 py-1.5 rounded-md ${busy?"opacity-60":""} bg-blue-600 text-white`}>{busy?"Asking…":"Ask"}</button>
              <button disabled={busy} onClick={()=>ask(true)} className={`px-3 py-1.5 rounded-md ${busy?"opacity-60":""} bg-amber-600 text-white`}>{busy?"Refreshing…":"Ask (force fresh)"}</button>
              <label className="ml-2 text-sm">Detail:
                <select value={detail} onChange={e=>setDetail(e.target.value as any)} className="ml-2 rounded-md border px-2 py-1">
                  <option value="short">Short</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>
              </label>
              <label className="text-sm inline-flex items-center gap-2 ml-2">
                <input type="checkbox" checked={autoContinue} onChange={e=>setAutoContinue(e.target.checked)} />
                Auto-continue to Model Selection
              </label>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={autoFallback} onChange={e=>setAutoFallback(e.target.checked)} />
                Auto-fallback to local
              </label>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={interactive} onChange={e=>setInteractive(e.target.checked)} />
                Interactive mode (beta)
              </label>
            </div>
            {error ? <div className="mt-2 text-sm text-rose-500">Error: {error}</div> : null}
          </Card>

          <Card title="Results" subtitle="Structured Markdown answer">
            <ExplainHeader category={res?.explainStruct?.category} confidence={res?.explainStruct?.confidence} />
{hasKpi ? <KpiImpactTable rows={res!.explainStruct!.kpi_impact!} /> : null}
            <ExplainSections structured={res?.explainStruct as any} markdown={stripKpiSection(res?.explanation || "")} narrative={narrativeMd} />
          </Card>
        </section>

        {/* RIGHT */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <WeightsPanel
            dense={wDense} sparse={wSparse} cross={wCross}
            onDense={setWDense} onSparse={setWSparse} onCross={setWCross}
            irOnline={provider!=="Stub (local)"}
          />
          <Card title="Embedding Provider">
            <select value={provider} onChange={e=>setProvider(e.target.value)} className="rounded-md border px-2 py-1 w-full">
              <option>Stub (local)</option>
              <option>Ollama (dense-only)</option>
              <option>Cohere (IR required)</option>
            </select>
            <p className="mt-2 text-xs text-zinc-500">IR online enables dense+sparse+cross; local stub ignores sparse/cross.</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}