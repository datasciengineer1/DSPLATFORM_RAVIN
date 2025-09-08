"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepNav from "@/components/ui/StepNav";
import SmartChart from "@/components/SmartChart";
import BarChart from "@/components/BarChart";
import ScatterChart from "@/components/ScatterChart";
import HistogramChart from "@/components/HistogramChart";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import { detectTask } from "@/utils/nlq";
import RetrievalTransparency from "@/components/RetrievalTransparency";
import VoiceButton from "@/components/ui/VoiceButton";
import TTSButton from "@/components/ui/TTSButton";
import { planCharts } from "@/components/ChartPlanner";

/* --------------------------- helpers --------------------------- */
const norm = (s?: string|null) =>
  (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");

function hashHex(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(16);
}
const makeKey = (q: string, datasetId: string|null, lang: string) =>
  "ans:" + hashHex(norm(q) + "|" + (datasetId ?? "") + "|" + (lang || ""));

type SavedAns = { answer: string; provider?: string; model?: string; ts?: number };
function readAnsByKey(key: string): SavedAns | null {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
function writeAnsByKey(key: string, v: SavedAns) {
  sessionStorage.setItem(key, JSON.stringify({ ...v, ts: Date.now() }));
}
function inferLangFromText(t: string): string | null {
  const s = t || "";
  if (/[\u0900-\u097F]/.test(s)) return "hi-IN";
  if (/[ñáéíóúü¿¡]/i.test(s)) return "es-ES";
  if (/[àâçéèêëîïôùûüÿœ]/i.test(s)) return "fr-FR";
  return null;
}

/* ------------------------------- page -------------------------------- */
export default function PredictPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // Core state
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [question, setQuestion]   = useState<string>("");
  const [rows, setRows]           = useState<any[]>([]);

  // Explanation (cached per key)
  const [answer, setAnswer]       = useState<string>("");
  const [provider, setProvider]   = useState<string>("");

  // Language (single hook)
  const [lang, setLang] = useState(
    typeof navigator !== "undefined" ? navigator.language : "en-US"
  );

  // Model summary (display-only)
  const [modelMode, setModelMode] = useState<"automl" | "manual">("automl");
  const [modelTask, setModelTask] = useState<string>("forecast");
  const [modelName, setModelName] = useState<string>("");

  // UX
  const [asking, setAsking] = useState(false);
  const [err, setErr]       = useState("");

  // Voice
  const [autoAsk, setAutoAsk] = useState(true);

  // Key for current inputs
  const currentKey = useMemo(() => makeKey(question, datasetId, lang), [question, datasetId, lang]);

  // Initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ds = sp.get("dataset") || sessionStorage.getItem("nlq.datasetId") || null;
    const q  = sp.get("q")       || sessionStorage.getItem("nlq.question") || "";
    setDatasetId(ds);
    setQuestion(q);

    try {
      const r = JSON.parse(sessionStorage.getItem("nlq.rows") || "[]");
      setRows(Array.isArray(r) ? r.map((x:any)=>({...x})) : []);
    } catch {}

    try {
      const mc = JSON.parse(sessionStorage.getItem("model.choice") || "{}");
      if (mc?.mode === "manual" || mc?.mode === "automl") setModelMode(mc.mode);
      if (mc?.task) setModelTask(mc.task);
      if (mc?.algo) setModelName(mc.algo);
    } catch {}
    const auto = sessionStorage.getItem("automl.modelName") || "";
    if (auto) setModelName(auto);
  }, [sp]);

  // Load cached answer for key
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = readAnsByKey(currentKey);
    if (saved) { setAnswer(saved.answer || ""); setProvider(saved.provider || ""); }
    else { setAnswer(""); setProvider(""); }
  }, [currentKey]);

  function onChangeQuestion(next: string) {
    setQuestion(next);
    const det = inferLangFromText(next);
    if (det && det !== lang) setLang(det);
  }

  async function onAsk() {
    if (!question || asking) return;
    setErr(""); setAnswer(""); setProvider("");

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("nlq.answer");
      sessionStorage.removeItem("nlq.provider");
      sessionStorage.setItem("nlq.question", question);
      sessionStorage.setItem("nlq.datasetId", datasetId ?? "");
    }

    setAsking(true);
    try {
      const r = await fetch("/api/explain/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          datasetId,
          questionLang: lang,
          context: "Return concise bullets: what was asked, what I did, key drivers (3–5), confidence & caveats (1–3), next best actions (2–4).",
          mode: "fast",
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const a = j?.answer || "";
      const p = j?.provider || "ollama";
      setAnswer(a); setProvider(p);
      if (typeof window !== "undefined") {
        writeAnsByKey(currentKey, { answer: a, provider: p, model: j?.model });
      }
    } catch (e:any) {
      setErr(e?.message || "Ask failed");
    } finally {
      setAsking(false);
    }
  }

  function onVoiceFinal(text: string) {
    onChangeQuestion(text);
    if (autoAsk) setTimeout(() => onAsk(), 0);
  }

  function clearAllCached() {
    if (typeof window === "undefined") return;
    const keys = Object.keys(sessionStorage);
    for (const k of keys) if (k.startsWith("ans:")) sessionStorage.removeItem(k);
    setAnswer(""); setProvider("");
  }

  const fontFamily = "Arial, ui-sans-serif, system-ui";
  const fontSize   = 14;

  const planned = planCharts(question, rows);

  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="predict" />

      {/* Prompt + voice */}
      <div className="rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <input
          value={question}
          onChange={(e)=>onChangeQuestion(e.target.value)}
          className="w-full bg-transparent outline-none text-base"
          placeholder="Ask a forecasting question…"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VoiceButton onFinal={onVoiceFinal} lang={lang} />
            <select
              className="text-xs border rounded px-2 py-1"
              value={lang}
              onChange={(e)=>setLang(e.target.value)}
              title="Speech & TTS language"
            >
              <option value="en-US">en-US</option>
              <option value="hi-IN">hi-IN</option>
              <option value="es-ES">es-ES</option>
              <option value="fr-FR">fr-FR</option>
              <option value="de-DE">de-DE</option>
              <option value="zh-CN">zh-CN</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={autoAsk} onChange={(e)=>setAutoAsk(e.target.checked)} />
              Auto-ask after speech
            </label>
            <button
              onClick={onAsk}
              disabled={!question || asking}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-60"
            >
              {asking ? "Asking…" : "Ask"}
            </button>
            <button onClick={clearAllCached} className="px-3 py-1.5 rounded-lg border" title="Clear cached explanations">
              Clear cache
            </button>
            <button onClick={()=>router.back()} className="px-3 py-1.5 rounded-lg border">
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Model summary */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 text-sm">
            <b>Model:</b>{" "}
            {modelMode==="manual"
              ? <>Manual → {modelTask} → <b>{modelName || "(choose on Model step)"}</b></>
              : <>AutoML → <b>{modelName || "(backend selects best)"}</b></>}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        {/* LEFT: planner-driven charts + retrieval */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {planned.map((spec, i) => (
            <div key={i} className="rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-sm font-semibold">{spec.title}</div>
                <div className="text-[11px] text-zinc-500">
                  {spec.xLabel && spec.yLabel ? `${spec.xLabel} → ${spec.yLabel}` : ""}
                </div>
              </div>
              {spec.component === "SmartChart" && (
                <SmartChart rows={rows} title={spec.title} xLabel={spec.xLabel} yLabel={spec.yLabel} fontFamily={fontFamily} fontSize={fontSize}/>
              )}
              {spec.component === "ScatterChart" && (
                <ScatterChart rows={rows} title={spec.title} fontFamily={fontFamily} fontSize={fontSize}/>
              )}
              {spec.component === "BarChart" && (
                <BarChart rows={rows} title={spec.title} xLabel={spec.xLabel} yLabel={spec.yLabel} fontFamily={fontFamily} fontSize={fontSize}/>
              )}
              {spec.component === "HistogramChart" && (
                <HistogramChart rows={rows} title={spec.title} fontFamily={fontFamily} fontSize={fontSize}/>
              )}
              <div className="mt-2 text-[12px] text-zinc-500">Why this chart: {spec.rationale}</div>
            </div>
          ))}

          <div className="rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
            <div className="text-sm font-semibold mb-3">Retrieval transparency</div>
            <RetrievalTransparency q={question} dataset={datasetId || ""} />
          </div>
        </div>

        {/* RIGHT: Explainability + Suggestions */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
            <div className="text-sm font-semibold mb-2">Explainability</div>
            <div className="max-h-[520px] overflow-y-auto pr-1 text-sm leading-6 whitespace-pre-wrap">
              {answer ? (
                <>
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: (answer || "")
                        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
                        .replace(/\n\* /g, "<br>• ")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">Key: {currentKey.slice(0,8)}…</div>
                    <TTSButton text={answer || ""} lang={lang} />
                  </div>
                </>
              ) : (
                <div className="text-zinc-500">No explanation cached for this question. Click <b>Ask</b> to generate one.</div>
              )}
              {err && <div className="mt-2 text-xs text-red-500">{String(err)}</div>}
            </div>
          </div>

          <div className="rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
            <div className="text-sm font-semibold mb-2">Suggestions</div>
            <RecommendationsPanel task={detectTask(question)} target={undefined} onPick={(t)=>setQuestion(t)} />
          </div>
        </div>
      </div>
    </main>
  );
}
