"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BigLine, { SeriesItem } from "@/app/components/BigLine";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Predict2Page() {
  const sp = useSearchParams();
  const datasetId = sp.get("dataset") || sp.get("id");
  const initialQ =
    sp.get("q") ||
    "What is the sales forecast for next 2 quarters based on last 2 years of data?";

  const [question, setQuestion] = useState(initialQ);
  const [mode, setMode] = useState<"smart"|"topn"|"all">("smart");
  const [topN, setTopN] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [labels, setLabels] = useState<{title?:string,target?:string,horizon?:number} | null>(null);
  const [metrics, setMetrics] = useState<{rmse?:number|null,mae?:number|null} | null>(null);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [explain, setExplain] = useState<string|undefined>();

  const disabled = !datasetId || loading;

  async function run() {
    if (!datasetId) return;
    setLoading(true); setErr(null);
    setSeries([]); setExplain(undefined);

    try {
      // NOTE: backend can ignore mode/topN for now; this is forward-compatible
      const j = await postJSON("/api/predict/run", {
        datasetId, question, mode, n: topN
      });

      setLabels(j?.labels ?? null);
      setMetrics(j?.metrics ?? null);
      setExplain(j?.explain);
      // Normalize any possible shapes into SeriesItem[]
      const s: SeriesItem[] = Array.isArray(j?.series)
        ? j.series.map((it:any) => ({
            name: it?.name ?? it?.key ?? "series",
            x: it?.x ?? it?.timestamps ?? [],
            y: it?.y ?? it?.values ?? [],
          }))
        : [];
      setSeries(s);
    } catch(e:any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  const hasData = series && series.length > 0;

  return (
    <main className="container mx-auto px-4 py-4">
      <div className="mb-3 text-sm flex gap-2 flex-wrap">
        <a className="px-3 py-1.5 rounded-full border bg-white" href="/data">1. Data</a>
        <a className="px-3 py-1.5 rounded-full border bg-white" href="/workspace">2. EDA</a>
        <a className="px-3 py-1.5 rounded-full border bg-white" href="/engineering">3. Engineering</a>
        <a className="px-3 py-1.5 rounded-full border bg-white" href="/nlq">4. NLQ</a>
        <a className="px-3 py-1.5 rounded-full border bg-white" href="/model">5. Model</a>
        <span className="px-3 py-1.5 rounded-full border bg-blue-600 text-white">6. Predict/Explain (v2)</span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left - recommendations / dataset */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">Recommended</div>
            <div className="flex flex-col gap-2 text-sm">
              {[
                "What are top 5 drivers of [target=Revenue]?",
                "Forecast next 6 months of [target=Revenue]",
                "Show partial dependence of the most important feature on [target=Revenue]",
                "Optimize classification threshold for [target=Revenue] (if applicable)"
              ].map((q,i)=>(
                <button
                  key={i}
                  className="text-left px-3 py-2 border rounded-lg hover:bg-zinc-50"
                  onClick={()=>setQuestion(q)}
                >{q}</button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="font-semibold mb-2">Dataset</div>
            <div>ID:</div>
            <div className="font-mono">{datasetId ?? "(none)"}</div>
          </div>
        </div>

        {/* Center - question + results */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">Ask a question</div>
            <div className="text-xs text-zinc-500 mb-2">
              Examples: forecasting, regression, classification.
            </div>

            <textarea
              value={question}
              onChange={(e)=>setQuestion(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-20"
            />

            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm">Mode</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={mode}
                onChange={(e)=>setMode(e.target.value as any)}
              >
                <option value="smart">Smart (overview first)</option>
                <option value="topn">Top-N</option>
                <option value="all">All series</option>
              </select>

              {mode === "topn" && (
                <>
                  <label className="text-sm">N</label>
                  <input
                    type="number"
                    min={1}
                    className="border rounded px-2 py-1 w-20 text-sm"
                    value={topN}
                    onChange={(e)=>setTopN(parseInt(e.target.value || "10",10))}
                  />
                </>
              )}

              <button
                onClick={run}
                disabled={disabled}
                className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {loading ? "Running…" : "Run"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">Results</div>
            {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
            {!err && hasData && (
              <BigLine
                series={series}
                title={labels?.title ?? (labels?.target ? `Forecast of ${labels.target}` : undefined)}
                height={420}
              />
            )}
            {!err && !hasData && (
              <div className="text-sm text-zinc-500">
                Run a question to see the forecast / model results here.
              </div>
            )}
            {metrics && (
              <div className="mt-2 text-xs text-zinc-600">
                RMSE: {metrics.rmse ?? "—"} &nbsp; MAE: {metrics.mae ?? "—"}
              </div>
            )}
          </div>
        </div>

        {/* Right - explainability / details */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">Explainability</div>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {explain ? explain : "Run a question to see a detailed explanation here."}
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="font-semibold mb-2">Details</div>
            <div>Target: {labels?.target ?? "—"}</div>
            <div>Horizon: {labels?.horizon ?? "—"}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
