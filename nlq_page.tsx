"use client";
import VoiceButton from "@/components/ui/VoiceButton";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepNav from "@/components/ui/StepNav";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import { detectTask } from "../../utils/nlq";

export default function NLQPage(){
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState("What is the sales forecast for next 2 quarters based on last 2 years of data?");
  const [dataset, setDataset] = useState<string|null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [skipModel, setSkipModel] = useState(false);

  const ctl = useRef<AbortController|null>(null);
  const reqIdRef = useRef(0);

  useEffect(()=>{
    const s = sp.get("dataset") || sp.get("id") ||
      (typeof window!=="undefined" ? sessionStorage.getItem("currentDatasetId") : null);
    setDataset(s || null);
  },[sp]);

  function goNext(ds:string, task:string, question:string){
    if (skipModel) {
      router.push(`/model?dataset=${encodeURIComponent(ds)}&task=${encodeURIComponent(task)}&q=${encodeURIComponent(question)}`);
    } else {
      router.push(`/model?dataset=${encodeURIComponent(ds)}&task=${encodeURIComponent(task)}&q=${encodeURIComponent(question)}`);
    }
  }

  async function onAnalyze(){
    if(analyzing) return;
    setError("");
    const ds = dataset || "demo";
    const task = detectTask(q || "");

    ctl.current?.abort?.();
    const ac = new AbortController();
    ctl.current = ac;
    const rid = ++reqIdRef.current;
    setAnalyzing(true);

    try {
      // Primary: lightweight NLQ to get rows (for chart)
      const r = await fetch("/api/nlq", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({ query: q, datasetId: ds }),
        signal: ac.signal,
        cache: "no-store",
      });
      if(!r.ok) throw new Error(`NLQ HTTP ${r.status}`);
      const json = await r.json();

      if (reqIdRef.current === rid) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("nlq.sql", json?.sql ?? "");
          sessionStorage.setItem("nlq.rows", JSON.stringify(json?.rows ?? []));
          sessionStorage.setItem("nlq.question", q);
          sessionStorage.setItem("nlq.datasetId", ds);
        }
        goNext(ds, task, q);
      }
    } catch (_e) {
      try {
        // Fallback: generate explainability only
        const r2 = await fetch("/api/explain/llm", {
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ question: q, datasetId: ds }),
          signal: ac.signal,
          cache: "no-store",
        });
        if(!r2.ok) throw new Error(`Explain HTTP ${r2.status}`);
        const ex = await r2.json();

        if (reqIdRef.current === rid) {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("nlq.answer", ex?.answer ?? "");
            sessionStorage.setItem("nlq.provider", ex?.provider ?? "ollama");
            sessionStorage.setItem("nlq.question", q);
            sessionStorage.setItem("nlq.datasetId", ds);
          }
          goNext(ds, task, q);
        }
      } catch (e:any) {
        if (reqIdRef.current === rid) setError(e?.message || "Analyze failed");
      }
    } finally {
      if (reqIdRef.current === rid) setAnalyzing(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="nlq" />
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
        <div className="text-lg font-semibold mb-3">Step 4: NLQ</div>

        <textarea
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          rows={3}
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Ask a question about your data…"
        />
        <div className="flex items-center gap-2 text-sm text-zinc-400 mt-2">
          <input id="skipModel" type="checkbox" className="h-4 w-4"
                 checked={skipModel} onChange={e=>setSkipModel(e.target.checked)} />
          <label htmlFor="skipModel">Skip model step (AutoML)</label>
        </div>

        <h2 className="text-sm font-semibold mb-2 mt-3">Suggestions</h2>
        <RecommendationsPanel
          task={detectTask(q)}
          target={undefined}
          onPick={(text)=>setQ(text)}
        />

        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onAnalyze}
            disabled={analyzing || !q}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-60">
            {analyzing ? "Analyzing…" : "Analyze question"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-3 py-1.5 rounded-lg border">Back</button>
        </div>

        <div className="mt-2"><VoiceButton onFinal={(t)=>setQ(t)} /></div>

        <div className="mt-3 text-sm text-zinc-500">
          Detected dataset: <span className="font-medium">{dataset ?? "(none)"}</span>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>
    </main>
  );
}
