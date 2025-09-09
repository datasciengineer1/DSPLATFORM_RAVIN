"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import SparkBars from "@/components/SparkBars";

type AutoResp = { task:string; recommendedModel:string; reasons:string[]; options:string[] };

function Card({title,subtitle,children}:{title:string;subtitle?:string;children:React.ReactNode}){
  return <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-5 bg-[var(--surface)]">
    <div className="mb-3"><h3 className="text-base md:text-lg font-semibold">{title}</h3>{subtitle?<p className="text-sm text-zinc-500">{subtitle}</p>:null}</div>
    {children}
  </div>;
}
function Button(props:any){return <button {...props} className={"px-3 py-1.5 text-sm rounded-md "+(props.className||"bg-blue-600 text-white hover:bg-blue-700")} />}

export default function ModelPage(){
  const [nlq,setNlq] = useState("");
  const [mode,setMode] = useState<"auto"|"manual">("auto");
  const [auto,setAuto] = useState<AutoResp|null>(null);
  const [task,setTask] = useState("regression");
  const [model,setModel] = useState("Linear Regression");
  const [explain,setExplain] = useState<any|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const url = new URL(window.location.href);
    const q = url.searchParams.get("nlq");
    const runAuto = url.searchParams.get("auto")==="1";
    if(q) setNlq(q);
    if (runAuto && q) {
      (async()=>{
        await new Promise(r=>setTimeout(r,50));
        await fetch("/api/model/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq:q, mode:"auto" })}).then(r=>r.json()).then(setAuto);
        await fetch("/api/nlq/query",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq:q, language:"auto", provider:"stub", weights:{dense:0.6,sparse:0.2,cross:0.2}, forceFresh:false })}).then(r=>r.json()).then(setExplain);
      })();
    }
  },[]);

  async function runAuto(){
    setBusy(true); setAuto(null);
    const r = await fetch("/api/model/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq, mode:"auto" })});
    const j = await r.json(); setAuto(j);
    setTask(j.task); setModel(j.recommendedModel);
    setBusy(false);
  }
  async function runManual(){
    setBusy(true); setAuto(null);
    const r = await fetch("/api/model/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq, mode:"manual", manual:{ task, model } })});
    const j = await r.json(); setAuto(j); setBusy(false);
  }
  async function predictExplain(forceFresh=false){
    setBusy(true); setExplain(null);
    const r = await fetch("/api/nlq/query",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq, language:"auto", provider:"stub", weights:{dense:0.6,sparse:0.2,cross:0.2}, forceFresh })});
    const j = await r.json(); setExplain(j); setBusy(false);
  }
  async function deleteCache(){
    await fetch("/api/nlq/cache",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({ nlq })});
    alert("Cache deleted for this NLQ (if existed).");
  }

  const top = explain?.retrieval?.hits?.[0];
  const denseC = top?.contributions?.dense ?? (top?.cosine ?? 0);
  const sparseC= top?.contributions?.sparse ?? (top?.sparse ?? 0);
  const crossC = top?.contributions?.cross ?? (top?.rerank ?? 0);

  return (
    <main className="container mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Model Selection — AutoML & Manual • Predict/Explain</h1>
        <Link href="/nlq" className="px-3 py-1.5 rounded-md border">← NLQ</Link>
      </div>

      <Card title="NLQ Context">
        <div className="grid md:grid-cols-[1fr_auto_auto] items-start gap-3">
          <textarea value={nlq} onChange={e=>setNlq(e.target.value)} placeholder="Paste/enter NLQ here"
            className="w-full min-h-[72px] rounded-md border p-2" />
          <Button onClick={()=>predictExplain(false)} disabled={!nlq || busy}>Predict/Explain</Button>
          <Button onClick={()=>predictExplain(true)} className="bg-amber-600 text-white" disabled={!nlq || busy}>Regenerate (Ollama)</Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={deleteCache} className="bg-transparent text-red-600 border border-red-600">Delete cache</Button>
          <Link href={`/model?nlq=${encodeURIComponent(nlq)}`} className="px-3 py-1.5 text-sm rounded-md border">Refresh with NLQ</Link>
        </div>
      </Card>

      <Card title="Selection Mode" subtitle="AutoML infers task & suggests an algorithm. Manual lets you choose.">
        <div className="flex gap-2 mb-3">
          <Button onClick={()=>setMode("auto")} className={mode==="auto"?"bg-zinc-900 text-white":"bg-transparent border"}>AutoML (Default)</Button>
          <Button onClick={()=>setMode("manual")} className={mode==="manual"?"bg-zinc-900 text-white":"bg-transparent border"}>Manual</Button>
        </div>

        {mode==="auto" ? (
          <div className="space-y-3">
            <Button onClick={runAuto} disabled={!nlq || busy}>Run AutoML Selection</Button>
            {auto && (
              <div className="rounded-lg border p-3 text-sm">
                <div><b>Task:</b> {auto.task}</div>
                <div><b>Recommended:</b> {auto.recommendedModel}</div>
                <div className="mt-2"><b>Why:</b>
                  <ul className="list-disc ml-5">{auto.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>
                </div>
                <div className="mt-2"><b>Other options:</b> {auto.options.join(" · ")}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-500">Problem type</span>
              <select value={task} onChange={e=>setTask(e.target.value)} className="border rounded-md px-2 py-1.5">
                <option value="regression">Regression</option>
                <option value="classification">Classification</option>
                <option value="forecasting">Forecasting</option>
                <option value="clustering">Clustering</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-500">Model</span>
              <select value={model} onChange={e=>setModel(e.target.value)} className="border rounded-md px-2 py-1.5">
                {task==="regression" && ["Linear Regression","Ridge","Lasso","Random Forest Regressor","XGBoost Regressor","CatBoost Regressor"].map(m=><option key={m}>{m}</option>)}
                {task==="classification" && ["Logistic Regression","Random Forest Classifier","XGBoost Classifier","CatBoost Classifier"].map(m=><option key={m}>{m}</option>)}
                {task==="forecasting" && ["Moving Average","ARIMA","SARIMA","Prophet"].map(m=><option key={m}>{m}</option>)}
                {task==="clustering" && ["KMeans","DBSCAN","HDBSCAN"].map(m=><option key={m}>{m}</option>)}
              </select>
            </label>
            <div className="flex items-end"><Button onClick={runManual} disabled={!nlq || busy}>Select</Button></div>
          </div>
        )}
      </Card>

      {explain && (
        <>
          <Card title={"Predict/Explain — " + (explain.fromCache?"From Cache":"Fresh")}>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{explain.explanation}</div>
          </Card>

          <Card title="Retrieval Weights & Contributions" subtitle={explain?.retrieval?.formula || "Normalized weights and top-hit contributions"}>
            {explain?.retrieval?.normWeights && (
              <div className="text-sm mb-2">
                <b>Normalized weights:</b>{" "}
                dense {explain.retrieval.normWeights.dense.toFixed(2)},{" "}
                sparse {explain.retrieval.normWeights.sparse.toFixed(2)},{" "}
                cross {explain.retrieval.normWeights.cross.toFixed(2)}
              </div>
            )}
            {top && (
              <div className="mb-3">
                <div className="text-xs text-zinc-500 mb-1">Top candidate contributions</div>
                <SparkBars dense={denseC} sparse={sparseC} cross={crossC} />
              </div>
            )}
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left"><th className="px-2 py-1">Candidate</th><th className="px-2 py-1">Cos</th><th className="px-2 py-1">Sparse</th><th className="px-2 py-1">Cross</th><th className="px-2 py-1">Combined</th></tr></thead>
                <tbody>
                  {explain.retrieval?.hits?.map((h:any,i:number)=>(
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
          </Card>
        </>
      )}
    </main>
  );
}
