import DonutShare from "//app/components/charts/DonutShare";
"use client";

import Markdown from "@/components/ui/Markdown";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter,
  CartesianGrid, Legend, Label, LabelList
} from "recharts";


// --- chart label helpers ---
const short = (s:any) => { s = String(s ?? ""); return s.length > 10 ? s.slice(0,10) + "…" : s; };
const nf = (n:any) => typeof n === "number" ? new Intl.NumberFormat("en-US").format(n) : n;
const AUTO_LOAD_SAMPLE = true;

/* ------------------------- helpers ------------------------- */

/** If server fell back to demo, switch the UI/session to demo immediately. */
const fmt = (v: any) =>
  typeof v === "number"
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
    : v;

function adoptDemoFallback(
  router: ReturnType<typeof import("next/navigation").useRouter>,
  setDatasetId: (s: string) => void,
  setDatasetName: (s: string | null) => void
) {
  try {
    sessionStorage.setItem("currentDatasetId", "demo");
    sessionStorage.setItem("currentDatasetName", "Sample: Demo");
  } catch {}
  setDatasetId("demo");
  setDatasetName("Sample: Demo");
  router.replace(`/workspace?dataset=demo`);
}

function combineSeries(actual: Array<number | null> = [], forecast: Array<number | null> = []) {
  const n = Math.max(actual.length, forecast.length);
  return Array.from({ length: n }, (_, i) => ({
    idx: i + 1,
    actual: Number.isFinite(actual[i] as number) ? (actual[i] as number) : null,
    forecast: Number.isFinite(forecast[i] as number) ? (forecast[i] as number) : null,
  }));
}
async function fetchJSON(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function postForm(path: string, form: FormData) {
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface EdaKpi { label: string; value: string | number }
interface ScatterDatum { x: number; y: number }

const COLORS = ["#2563eb","#16a34a","#f59e0b","#ef4444","#a855f7","#06b6d4","#f97316","#22c55e","#3b82f6","#e11d48"];
const topByValue = (arr: any[] = []) => arr?.reduce((a: any, b: any) => (b.value > (a?.value ?? -Infinity) ? b : a), null);
const trendExplanation = (arr: any[] = []) => {
  if (!arr?.length) return "—";
  const first = arr[0]?.value ?? 0, last = arr[arr.length - 1]?.value ?? 0;
  if (last > first) return "Upward trend overall.";
  if (last < first) return "Downward trend overall.";
  return "Flat/unchanged trend.";
};

/* ------------------------- page ------------------------- */
export default function EDAWorkspacePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);

  const [summary, setSummary] = useState<any>(null);
  const [missing, setMissing] = useState<any>(null);
  const [corr, setCorr] = useState<any>(null);

  const [pgTable, setPgTable] = useState("");
  const [sqPath, setSqPath] = useState("");
  const [sqTable, setSqTable] = useState("");

  useEffect(() => {
    const fromUrl = sp.get("dataset") || sp.get("id");
    const sId = typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetId") : null;
    const sName = typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetName") : null;

    if (fromUrl) { setDatasetId(fromUrl); setDatasetName(sName || null); return; }
    if (sId)     { setDatasetId(sId);     setDatasetName(sName || null); return; }
    if (AUTO_LOAD_SAMPLE) { setDatasetId("demo"); setDatasetName("Sample: Retail (demo)"); }
  }, [sp]);

  async function reloadEda(forId: string) {
    setSummary(null); setMissing(null); setCorr(null); setError(null);
    setLoading(true);
    const enc = encodeURIComponent(forId);
  
    try {
      const [s, m, c] = await Promise.allSettled([
        fetchJSON(`/api/eds/summary/${enc}`),
        fetchJSON(`/api/eds/missing/${enc}`),
        fetchJSON(`/api/eds/corr/${enc}?top=20`),
      ]);
  
      if (s.status === "fulfilled") setSummary(s.value);
      if (m.status === "fulfilled") setMissing(m.value);
      if (c.status === "fulfilled") setCorr(c.value);
  
      // ⬇️ NEW: if server fell back to demo, immediately adopt demo id/name & reroute.
      const fallbackFrom =
        s.status === "fulfilled" && (s.value as any)?.__fallbackFrom
          ? (s.value as any).__fallbackFrom
          : null;
  
      if (fallbackFrom) {
        adoptDemoFallback(router, (id) => setDatasetId(id), (name) => setDatasetName(name));
        return; // stop; useEffect will re-run with "demo"
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load EDA");
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => { if (datasetId) reloadEda(datasetId); }, [datasetId]);

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.target as HTMLInputElement | null;
    const file = inputEl?.files?.[0]; if (!file) return;
    try {
      setLoading(true); setError(null);
      const form = new FormData(); form.append("file", file);
      const resp = await postForm("/api/upload/csv", form);
      const newId = String(resp?.id ?? `csv:${file.name}`);
      const newName = String(resp?.name ?? file.name ?? "CSV");
      sessionStorage.setItem("currentDatasetId", newId);
      sessionStorage.setItem("currentDatasetName", newName);
      setDatasetId(newId); setDatasetName(newName);
      router.replace(`/workspace?dataset=${encodeURIComponent(newId)}`);
    } catch (err: any) { setError(err?.message ?? "Upload failed"); }
    finally { setLoading(false); if (inputEl) inputEl.value = ""; }
  }
  async function loadFromPostgres() {
    try{
      setLoading(true); setError(null);
      const r = await postJSON("/api/datasource/postgres/preview", { table: pgTable, limit: 100 });
      sessionStorage.setItem("currentDatasetId", r.id);
      sessionStorage.setItem("currentDatasetName", r.name);
      setDatasetId(r.id); setDatasetName(r.name);
      router.replace(`/workspace?dataset=${encodeURIComponent(r.id)}`);
      setSummary((s:any)=>({ ...(s||{}), preview: r.preview }));
    } catch(e:any){ setError(e?.message ?? "Failed to load from Postgres"); }
    finally{ setLoading(false); }
  }
  async function loadFromSQLite() {
    try{
      setLoading(true); setError(null);
      const r = await postJSON("/api/datasource/sqlite/preview", { dbPath: sqPath || undefined, table: sqTable, limit: 100 });
      sessionStorage.setItem("currentDatasetId", r.id);
      sessionStorage.setItem("currentDatasetName", r.name);
      setDatasetId(r.id); setDatasetName(r.name);
      router.replace(`/workspace?dataset=${encodeURIComponent(r.id)}`);
      setSummary((s:any)=>({ ...(s||{}), preview: r.preview }));
    } catch(e:any){ setError(e?.message ?? "Failed to load from SQLite"); }
    finally{ setLoading(false); }
  }

  const steps = [
    { label: "1. Data", href: "/data" },
    { label: "2. EDA", href: "/workspace" },
    { label: "3. Engineering", href: "/engineering" },
    { label: "4. NLQ", href: "/nlq" },
    { label: "5. Model", href: "/model" },
    { label: "6. Predict/Explain", href: "/predict" },
  ];

  // dynamic labels from backend
  const fields = summary?.fields || {};
  const L_COGS   = fields.xCogs   || "COGS";
  const L_REVEN  = fields.yRevenue|| "Revenue";
  const L_CAT    = fields.category|| "Category";
  const L_CITY   = fields.location|| "City";
  const L_DATE   = fields.date    || "Date";

  // chart data & fallbacks (if summary hasn't loaded yet)
  const distCOGS = summary?.distCOGS ?? [{ name:"0-100", value:120 }];
  const distRevenue = summary?.distRevenue ?? [{ name:"0-500", value:140 }];
  const countsByCategory = summary?.countsByCategory ?? [{ name:"Devices", value:120 }];
  const shareByCity = summary?.shareByCity ?? [{ name:"SF", value:30 }];
  const cogsVsRevenue: ScatterDatum[] = summary?.cogsVsRevenue ?? [{ x: 50, y: 30 }];
  const trendCogsByMonth = summary?.trendCogsByMonth ?? [{ name:"Jan", value:40 }];

  // --------- Preview table fallbacks (so the table always renders) ----------
  const previewRows: any[] = Array.isArray(summary?.preview)
    ? summary.preview
    : (Array.isArray(summary?.rows) ? summary.rows.slice(0, 100) : []);
  const previewHeader: string[] = previewRows.length
    ? Object.keys(previewRows[0])
    : Object.keys({ [L_DATE]: "", [L_CAT]: "", [L_COGS]: "", [L_REVEN]: "" });

  const kpis: EdaKpi[] = useMemo(() => {
    const rows = summary?.rowCount ?? (Array.isArray(summary?.rows) ? summary.rows.length : "—");
    const cols = summary?.colCount ?? (previewRows[0] ? Object.keys(previewRows[0]).length : "—");
    const numericCount = summary?.numericCount ?? "—";
    const categoricalCount = summary?.categoricalCount ?? "—";
    const fmt = (v: any) => (typeof v === "number" ? v.toLocaleString() : v);
    return [
      { label: "Rows", value: fmt(rows) },
      { label: "Columns", value: fmt(cols) },
      { label: "Numeric", value: fmt(numericCount) },
      { label: "Categorical", value: fmt(categoricalCount) },
    ];
  }, [summary, previewRows]);

  const mostMissing = useMemo(() => {
    const m = (summary?.missing ?? null) || null;
    return Array.isArray(m?.top) ? m.top.slice(0,6) : Array.isArray(m) ? m.slice(0,6) : [];
  }, [summary]);

  return (
    <main key={datasetId ?? "nosel"} className="container mx-auto px-4 py-4">
      {/* workflow header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 mb-4">
        <div className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {steps.map((s, i) => (
              <Link key={s.label} href={s.href}
                className={"px-3 py-1.5 rounded-full border text-sm " + (i===1 ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300")}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Dataset: <span className="font-medium">{datasetName ?? (datasetId ? `#${datasetId}` : "(none)")}</span>
        </div>
        <label className="text-sm text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-2">
          <span className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">Upload CSV</span>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
        </label>
        <button onClick={()=>{ const id="demo", name="Sample: Retail (demo)"; sessionStorage.setItem("currentDatasetId",id); sessionStorage.setItem("currentDatasetName",name); setDatasetId(id); setDatasetName(name); router.replace(`/workspace?dataset=${encodeURIComponent(id)}`); }} className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">Load Sample</button>
        {datasetId && <button onClick={()=>{ try{ sessionStorage.removeItem("currentDatasetId"); sessionStorage.removeItem("currentDatasetName"); }catch{}; const id = AUTO_LOAD_SAMPLE ? "demo" : ""; const name = AUTO_LOAD_SAMPLE ? "Sample: Retail (demo)" : null; setDatasetId(id || null); setDatasetName(name); router.replace(`/workspace${id?`?dataset=${encodeURIComponent(id)}`:""}`); }} className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">Clear</button>}
        {loading && <span className="text-sm text-zinc-500">Loading…</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* left sidebar */}
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Explainability</div></div>
            <div className="p-4">
              {loading && <div className="text-sm text-zinc-500">Analyzing dataset…</div>}
              {!loading && (
                <ul className="list-disc ml-5 text-sm space-y-2">
                  {(summary?.insights?.length ? summary.insights : [
                    `${L_REVEN} appears right-skewed (long tail).`,
                    `${L_COGS} and ${L_REVEN} show a positive relationship.`,
                    `Mild seasonality is present across ${L_DATE.toLowerCase()}s.`
                  ]).map((s: string, idx: number) => (<li key={idx}>{s}</li>))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Recommended</div></div>
            <div className="p-4">
              <div className="flex flex-col gap-2">
                {[
                  `How does ${L_REVEN} vary by ${L_DATE}?`,
                  `Is ${L_REVEN} correlated with ${L_CAT}?`,
                  `Which combination of ${L_DATE}, ${L_CAT} maximizes ${L_REVEN}?`,
                ].map((q, i) => (
                  <button key={i} className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">{q}</button>
                ))}
              </div>
            </div>
          </div>

          {/* loaders */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Load from databases</div></div>
            <div className="p-4 space-y-3 text-sm">
              <div className="font-medium">Postgres (uses POSTGRES_URL)</div>
              <div className="flex gap-2">
                <input className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-zinc-900" placeholder="table name (e.g., public.sales)" value={pgTable} onChange={e=>setPgTable(e.target.value)} />
                <button onClick={loadFromPostgres} className="px-3 py-2 rounded-lg border">Load</button>
              </div>
              <div className="font-medium pt-2">SQLite</div>
              <input className="border rounded-lg px-3 py-2 w-full mb-2 bg-white dark:bg-zinc-900" placeholder="SQLite path (defaults to SQLITE_PATH)" value={sqPath} onChange={e=>setSqPath(e.target.value)} />
              <div className="flex gap-2">
                <input className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-zinc-900" placeholder="table name" value={sqTable} onChange={e=>setSqTable(e.target.value)} />
                <button onClick={loadFromSQLite} className="px-3 py-2 rounded-lg border">Load</button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Summary</div></div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {kpis.map((k) => (
                  <div key={k.label} className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">{k.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{k.value}</div>
                  </div>
                ))}
              </div>
              {mostMissing.length ? (
                <div className="mt-4 text-sm">
                  <div className="font-medium">Most Missing</div>
                  <ul className="mt-1 space-y-1">
                    {mostMissing.map((m: any, idx: number) => (
                      <li key={idx} className="text-zinc-600 dark:text-zinc-400">
                        {m.column} <span className="text-xs">({m.count})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* main charts */}
        <div className="col-span-12 xl:col-span-6 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">2) EDA <span className="text-sm text-zinc-500">Auto-profiling summary &amp; visuals</span></div></div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Distribution of COGS */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0">
                    <div className="text-base font-semibold">{`Distribution of ${L_COGS}`}</div>
                    <div className="text-xs text-zinc-500">Spread &amp; skew of values</div>
                  </div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distCOGS}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" label={{ value: `${L_COGS} bins`, position: "insideBottom", offset: -5 }}  tickFormatter={short} />
                          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8,8,0,0]} fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: right tail suggests a few high-{L_COGS} records.</p>
                  </div>
                </div>

                {/* Distribution of Revenue */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0"><div className="text-base font-semibold">{`Distribution of ${L_REVEN}`}</div></div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distRevenue}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" label={{ value: `${L_REVEN} bins`, position: "insideBottom", offset: -5 }}  tickFormatter={short} />
                          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8,8,0,0]} fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: lower bins dominate; long tail at higher {L_REVEN.toLowerCase()}.</p>
                  </div>
                </div>

                {/* Counts by Category */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0"><div className="text-base font-semibold">{`Counts by ${L_CAT}`}</div><div className="text-xs text-zinc-500">Counts per {L_CAT.toLowerCase()}</div></div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={countsByCategory}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" label={{ value: L_CAT, position: "insideBottom", offset: -5 }}  tickFormatter={short} />
                          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" radius={[8,8,0,0]} fill="#a855f7" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: top {L_CAT.toLowerCase()} = {topByValue(countsByCategory)?.name ?? "—"}.</p>
                  </div>
                </div>

                {/* Share of City */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0"><div className="text-base font-semibold">{`Share of ${L_CITY}`}</div><div className="text-xs text-zinc-500">Relative share</div></div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={shareByCity} dataKey="value" nameKey="name" outerRadius={80} label={false} labelLine={false}>
                            {shareByCity.map((_: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                          </Pie>
                          <Tooltip /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: largest share = {topByValue(shareByCity)?.name ?? "—"}.</p>
                  </div>
                </div>

                {/* Scatter */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0"><div className="text-base font-semibold">{`${L_COGS} vs ${L_REVEN}`}</div><div className="text-xs text-zinc-500">Relationship, clusters, outliers</div></div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="x" name={L_COGS} label={{ value: L_COGS, position: "insideBottom", offset: -5 }} />
                          <YAxis dataKey="y" name={L_REVEN} label={{ value: L_REVEN, angle: -90, position: "insideLeft" }} />
                          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                          <Scatter data={cogsVsRevenue} fill="#06b6d4" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: positive association expected.</p>
                  </div>
                </div>

                {/* Trend */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="p-4 pb-0"><div className="text-base font-semibold">{`Trend of ${L_COGS} by ${L_DATE}`}</div><div className="text-xs text-zinc-500">Trend over time</div></div>
                  <div className="p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendCogsByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" label={{ value: L_DATE, position: "insideBottom", offset: -5 }}  tickFormatter={short} />
                          <YAxis label={{ value: L_COGS, angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} stroke="#2563eb" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Explanation: {trendExplanation(trendCogsByMonth)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Forecast (chart left + explainability right) ---------- */}
          {(() => {
            const rows = Array.isArray(previewRows) ? previewRows : [];

            // Find a date-like key (so we can label the X axis with dates if available)
            function pickDateKey(rs: any[]): string | null {
              if (!rs.length) return null;
              const keys = Object.keys(rs[0]);
              for (const k of keys) {
                let good = 0, total = 0;
                for (const r of rs.slice(0, 64)) {
                  const v = r[k];
                  if (v === null || v === undefined || v === "") continue;
                  total++;
                  const d = new Date(v as any);
                  if (!Number.isNaN(d.getTime())) good++;
                }
                if (total && good / total >= 0.6) return k;
              }
              return null;
            }

            // Find a numeric key to forecast
            function pickNumericKey(rs: any[]): string | null {
              const preferred = summary?.fields?.yRevenue || summary?.fields?.xCogs || null;
              if (preferred && rs.some(r => Number.isFinite(Number(String(r?.[preferred]).replace(/,/g, ""))))) {
                return preferred;
              }
              if (!rs.length) return null;
              const keys = Object.keys(rs[0]);
              for (const k of keys) {
                let good = 0, total = 0;
                for (const r of rs.slice(0, 64)) {
                  const v = r[k];
                  if (v === null || v === undefined || v === "") continue;
                  total++;
                  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
                  if (Number.isFinite(n)) good++;
                }
                if (total && good / total >= 0.7) return k;
              }
              return null;
            }

            // Source A: preview rows
            const keyFromRows = pickNumericKey(rows);
            const dateKey = pickDateKey(rows);
            const seriesFromRows: { label: string; values: Array<number | null>; labels?: string[] } | null = keyFromRows
              ? {
                  label: keyFromRows,
                  values: rows.map(r => {
                    const raw = r?.[keyFromRows];
                    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/,/g, ""));
                    return Number.isFinite(n) ? n : null;
                  }),
                  labels: dateKey ? rows.map(r => String(r?.[dateKey] ?? "")) : undefined,
                }
              : null;

            // Source B: backend trend
            const trend = Array.isArray(summary?.trendCogsByMonth) ? summary.trendCogsByMonth : [];
            const seriesFromTrend =
              trend.length > 0
                ? {
                    label: summary?.fields?.xCogs || summary?.fields?.yRevenue || "series",
                    values: trend.map((d: any) => Number(d?.value) || 0),
                    labels: trend.map((d: any) => String(d?.name ?? "")),
                  }
                : null;

            // Source C: histogram
            const hist: any[] =
              (Array.isArray(summary?.distRevenue) && summary!.distRevenue!.length && summary!.distRevenue) ||
              (Array.isArray(summary?.distCOGS) && summary!.distCOGS!.length && summary!.distCOGS) ||
              [];
            const seriesFromHist =
              hist.length > 0
                ? {
                    label: summary?.fields?.yRevenue ? "Revenue" : summary?.fields?.xCogs ? "COGS" : "series",
                    values: hist.map((d: any) => Number(d?.value) || 0),
                  }
                : null;

            const chosen =
              seriesFromRows ??
              seriesFromTrend ??
              seriesFromHist ?? { label: "series", values: [] as Array<number | null> };

            // Simple moving average forecast (connects nulls safely)
            function movingAverage(arr: Array<number | null>, window = 3) {
              if (!arr?.length) return [];
              const w = Math.max(3, Math.min(12, window));
              const out: Array<number | null> = Array(arr.length).fill(null);
              let sum = 0, cnt = 0;
              for (let i = 0; i < arr.length; i++) {
                const v = arr[i];
                if (Number.isFinite(v as number)) { sum += v as number; cnt++; }
                if (i >= w) {
                  const drop = arr[i - w];
                  if (Number.isFinite(drop as number)) { sum -= drop as number; cnt--; }
                }
                if (i >= w - 1 && cnt) out[i] = sum / cnt;
              }
              return out;
            }

            const actual = chosen.values;
            const window = Math.min(12, Math.max(3, Math.floor(actual.length / 6) || 3));
            const forecast = movingAverage(actual, window);

            // Build chart rows
            let data = combineSeries(actual, forecast);
            if (seriesFromRows?.labels && seriesFromRows.labels.length === data.length) {
              data = data.map((d: any, i: number) => ({ ...d, date: seriesFromRows!.labels![i] }));
            } else if (seriesFromTrend?.labels && seriesFromTrend.labels.length === data.length) {
              data = data.map((d: any, i: number) => ({ ...d, date: seriesFromTrend!.labels![i] }));
            }

            // X key
            const hasDate = data.length > 0 && "date" in data[0] && data.some((d: any) => d.date != null);
            const xKey = hasDate ? "date" : "idx";

            // Y domain (robust) – prevents lines from disappearing due to invalid domain
            const ys = data.flatMap(d => [d.actual, d.forecast]).filter((n): n is number => Number.isFinite(n as any));
            let yMin = ys.length ? Math.min(...ys) : 0;
            let yMax = ys.length ? Math.max(...ys) : 1;
            if (yMin === yMax) { yMin = yMin - 1; yMax = yMax + 1; }

            // Metrics
            function rmse(a: Array<number | null>, f: Array<number | null>) {
              let s = 0, n = 0;
              for (let i = 0; i < a.length; i++) {
                const av = a[i], fv = f[i];
                if (Number.isFinite(av as number) && Number.isFinite(fv as number)) { s += Math.pow((fv as number) - (av as number), 2); n++; }
              }
              return n ? Math.sqrt(s / n) : null;
            }
            function mae(a: Array<number | null>, f: Array<number | null>) {
              let s = 0, n = 0;
              for (let i = 0; i < a.length; i++) {
                const av = a[i], fv = f[i];
                if (Number.isFinite(av as number) && Number.isFinite(fv as number)) { s += Math.abs((fv as number) - (av as number)); n++; }
              }
              return n ? s / n : null;
            }
            const mRmse = rmse(actual, forecast);
            const mMae  = mae(actual, forecast);

            const empty =
              !data?.length ||
              (!data.some((d: any) => d.actual != null) && !data.some((d: any) => d.forecast != null));

            const seriesLabel = chosen.label || summary?.fields?.yRevenue || summary?.fields?.xCogs || "series";
            const modelName = `Moving average (window=${window})`;

            const explainMd =
              `### Summary for: ${summary?.question || "Forecast"}\n` +
              `**Task:** Forecasting\n` +
              `**Method:** ${modelName}\n` +
              `**Target:** **${seriesLabel}**\n` +
              `**Validation (last 2):** RMSE=${mRmse != null ? mRmse : "—"}, MAE=${mMae != null ? mMae : "—"}.\n` +
              `**Interpretation:** Orange = forecast (moving-average level); blue = actual.`;

            return (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
                <div className="p-4 pb-0">
                  <div className="text-lg font-semibold">{`Forecast of ${seriesLabel}`}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                      <div className="uppercase tracking-wider mb-0.5">Model</div>
                      <div className="font-medium">{modelName}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                      <div className="uppercase tracking-wider mb-0.5">RMSE</div>
                      <div className="font-medium">{mRmse != null ? Number(mRmse).toLocaleString() : "—"}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                      <div className="uppercase tracking-wider mb-0.5">MAE</div>
                      <div className="font-medium">{mMae != null ? Number(mMae).toLocaleString() : "—"}</div>
                    </div>
                  </div>
                </div>

                {/* chart (left) + explainability (right) */}
                <div className="p-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 lg:col-span-8">
                      {empty ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-8">
                          No forecastable series detected. Load a dataset with a numeric column (e.g., Revenue/COGS).
                        </div>
                      ) : (
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey={xKey} />
                              <YAxis domain={[yMin, yMax]} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="actual" name="actual" stroke="#60a5fa" strokeWidth={2} connectNulls dot={false} />
                              <Line type="monotone" dataKey="forecast" name="forecast" stroke="#f59e0b" strokeWidth={2} connectNulls dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 lg:col-span-4">
                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 h-full">
                        <div className="text-sm font-semibold mb-2">Explainability</div>
                        <Markdown>{explainMd}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* preview */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Preview (scroll)</div></div>
            <div className="p-4">
              <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">
                    <tr>
                      {previewHeader.map((h: string) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300 border-b">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row: any, idx: number) => (
                      <tr key={idx} className={idx % 2 ? "bg-white/50 dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/40"}>
                        {previewHeader.map((h, j) => (
                          <td key={j} className="px-3 py-2 border-b text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                            {String(row?.[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-zinc-500 mt-2">Showing up to 100 rows (scroll to view more).</div>
              <div className="flex justify-end gap-2 pt-3">
                <Link href="/data" className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">Back</Link>
                <Link href="/engineering" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Next</Link>
              </div>
            </div>
          </div>
        </div>

        {/* right sidebar */}
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Properties</div></div>
            <div className="p-4 text-sm">
              <div className="text-zinc-500">Dataset:</div>
              <div className="font-medium">{datasetName ?? (datasetId ? `#${datasetId}` : "(none)")}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
            <div className="p-4 pb-0"><div className="text-lg font-semibold">Data sources</div></div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {["DEMO","CSV","POSTGRES","SQLITE","BIGQUERY"].map(s=>(
                  <span key={s} className={`px-3 py-1.5 rounded-full text-xs border ${s==="CSV"?"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900":"border-zinc-200 dark:border-zinc-800"}`}>{s}</span>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-sm text-zinc-600 dark:text-zinc-300">Upload CSV</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="file" accept=".csv,.xlsx,.xls" className="text-sm" onChange={handleCsvUpload} />
                </div>
                {datasetName ? <div className="text-xs text-zinc-500 mt-1">Loaded: {datasetName}</div> : null}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="font-medium">Quick load</div>
                <div className="flex gap-2">
                  <input className="border rounded-lg px-2 py-1 w-full" placeholder="pg table (public.sales)" value={pgTable} onChange={e=>setPgTable(e.target.value)} />
                  <button onClick={loadFromPostgres} className="px-2 py-1 rounded-lg border">PG</button>
                </div>
                <div className="flex gap-2">
                  <input className="border rounded-lg px-2 py-1 w-full" placeholder="sqlite table" value={sqTable} onChange={e=>setSqTable(e.target.value)} />
                  <button onClick={loadFromSQLite} className="px-2 py-1 rounded-lg border">SQLITE</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
