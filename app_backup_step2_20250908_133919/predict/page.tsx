// app/predict/page.tsx
"use client";

import StepNav from "@/components/ui/StepNav";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TimeSeries from "@/components/charts/TimeSeries";
import DonutShare from "@/components/charts/DonutShare";
import {
  buildExplainability,
  combineSeries,
  detectTask,
  preferTarget,
  rmse,
  mae,
  DetectedTask,
} from "@/utils/nlq";

/* ───────────────────────────── Utility helpers ───────────────────────────── */

function toNumber(v: any) {
  // Accept: 1,234.56 | ($1,234) | (1,234) | 10k / 2.5M / 3B | "15%" | 123 | -456
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  let s = String(v).trim();
  if (!s) return undefined;

  // Percent
  let pct = false;
  if (s.endsWith("%")) {
    pct = true;
    s = s.slice(0, -1).trim();
  }

  // Parentheses for negatives
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1, -1);

  // Remove currency + thousands separators and spaces
  s = s.replace(/[\$,]/g, "").replace(/\s+/g, "");

  // Unit suffixes: k/m/b (case-insensitive)
  let mul = 1;
  if (/[kKmMbB]$/.test(s)) {
    const u = s.slice(-1).toLowerCase();
    s = s.slice(0, -1);
    if (u === "k") mul = 1e3;
    else if (u === "m") mul = 1e6;
    else if (u === "b") mul = 1e9;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return (pct ? n / 100 : n) * mul;
}

function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i];
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    k++; sx += xi; sy += yi; sxx += xi * xi; syy += yi * yi; sxy += xi * yi;
  }
  if (k < 3) return 0;
  const mx = sx / k, my = sy / k;
  const cov = sxy / k - mx * my;
  const vx = sxx / k - mx * mx;
  const vy = syy / k - my * my;
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
}

async function fetchJSON(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...(init || {}) });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}
async function fetchJSONto(path: string, ms = 4000, init?: RequestInit) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(path, { cache: "no-store", signal: ac.signal, ...(init || {}) });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    return res.json();
  } finally { clearTimeout(t); }
}

/* ─────────────────────────── Preview + column helpers ─────────────────────────── */

async function getPreview(datasetId: string) {
  const p = await fetchJSON(`/api/data/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: datasetId, limit: 2000 }),
  });
  const rows: any[] = Array.isArray(p?.rows) ? p.rows : [];
  const cols: string[] = p?.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { rows, cols };
}
function pickDateKey(columns: string[]) {
  return columns.find((k) => /date|ds|day|month|week|period|timestamp|time/i.test(k)) || null;
}
function pickNumericColumns(rows: any[], cols: string[]) {
  return cols.filter((c) => rows.some((r) => Number.isFinite(toNumber(r[c]))));
}
function normalizeName(s: string) {
  return s.toLowerCase().replace(/[\s_\-\/]+/g, "");
}
function bestCategoricalColumn(rows: any[], cols: string[]) {
  const hints = [
    "channel","region","country","state","city","segment","category","dept","department",
    "sku","product","brand","source","campaign","market",
  ];
  const normCols = cols.map((c) => ({ raw: c, norm: normalizeName(c) }));
  const byHint =
    normCols.find((c) => hints.some((h) => c.norm.includes(normalizeName(h))))?.raw ??
    cols.find((c) => hints.some((h) => c.toLowerCase().includes(h)));

  const MAX = 500;
  const candidates = cols.filter((c) => {
    const vals = rows.map((r) => r[c]).filter((v) => v != null);
    if (!vals.length) return false;
    const uniq = new Set(vals.map((v) => String(v))).size;
    const mostlyStrings = vals.filter((v) => typeof v === "string").length > vals.length * 0.5;
    const looksId = /(^id$|id$|uuid$|guid$|code$)/i.test(c);
    return !looksId && ((uniq > 1 && uniq <= MAX) || mostlyStrings);
  });

  if (byHint && candidates.includes(byHint)) return byHint;
  if (candidates.length) return candidates[0];
  return null;
}

function topNCounts(rows: any[], cat: string, n = 12) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[cat]; if (v == null) continue;
    const k = String(v);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}
function topNBySum(rows: any[], cat: string, num: string, n = 12) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r[cat];
    const v = toNumber(r[num]);
    if (k == null || !Number.isFinite(v)) continue;
    m.set(String(k), (m.get(String(k)) || 0) + (v as number));
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, n);
}

/* ───────────────────────────── Date handling ───────────────────────────── */

function parseDateLoose(v: any): Date | null {
  if (v == null) return null;
  if (v instanceof Date && Number.isFinite(+v)) return v;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v);
  const s = String(v).trim();

  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s) || /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(+d) ? d : null;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) || /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(+d) ? d : null;
  }
  const mQ = s.match(/^(?:q([1-4])\s+(\d{4})|(\d{4})[-]?[qQ]([1-4]))$/);
  if (mQ) {
    const q = Number(mQ[1] || mQ[4]);
    const y = Number(mQ[2] || mQ[3]);
    const month = (q - 1) * 3;
    return new Date(Date.UTC(y, month, 1));
  }
  const d = new Date(s);
  return Number.isFinite(+d) ? d : null;
}

function filterRowsByTimeWindow(rows: any[], dateKey: string | null, qLower: string) {
  if (!dateKey) return rows;

  const spec =
    /\blast quarter\b/.test(qLower) ? { unit: "quarter" as const, n: 1 } :
    /\blast year\b/.test(qLower)    ? { unit: "year" as const, n: 1 } :
    /\blast month\b/.test(qLower)   ? { unit: "month" as const, n: 1 } :
    (() => {
      const y = qLower.match(/\blast\s+(\d+)\s+years?\b/);
      if (y) return { unit: "year" as const, n: Number(y[1]) };
      const m = qLower.match(/\blast\s+(\d+)\s+months?\b/);
      if (m) return { unit: "month" as const, n: Number(m[1]) };
      return null;
    })();

  if (!spec) return rows;

  const ds = rows
    .map((r) => ({ r, d: parseDateLoose(r[dateKey]) }))
    .filter((x) => x.d && Number.isFinite(+x.d)) as Array<{ r: any; d: Date }>;
  if (!ds.length) return rows;

  const maxD = new Date(Math.max(...ds.map((x) => +x.d)));
  let start = new Date(maxD);

  if (spec.unit === "quarter") {
    const q = Math.floor(start.getUTCMonth() / 3);
    const startQ = (q + 3) % 4;
    const yearAdj = q === 0 ? -1 : 0;
    start = new Date(Date.UTC(start.getUTCFullYear() + yearAdj, startQ * 3, 1));
  } else if (spec.unit === "year") {
    start = new Date(Date.UTC(maxD.getUTCFullYear() - spec.n, maxD.getUTCMonth(), maxD.getUTCDate()));
  } else if (spec.unit === "month") {
    start = new Date(Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth() - spec.n, maxD.getUTCDate()));
  }

  const filtered = ds.filter((x) => +x.d >= +start && +x.d <= +maxD).map((x) => x.r);
  return filtered.length ? filtered : rows;
}

/* ─────────────────────────── Histogram helper ─────────────────────────── */

function histogram(rows: any[], field: string, bins = 24) {
  const xs = rows.map((r) => toNumber(r[field])).filter(Number.isFinite) as number[];
  if (!xs.length) return null;
  const mn = Math.min(...xs), mx = Math.max(...xs);
  const w = (mx - mn) / (bins || 1) || 1;
  const counts = Array.from({ length: bins }, () => 0);
  xs.forEach((v) => {
    const idx = Math.min(Math.floor((v - mn) / w), bins - 1);
    counts[idx]++;
  });
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    bins: counts.map((c, i) => ({ bin: mn + i * w, count: c })),
    stats: { mean, median, min: mn, max: mx },
  };
}

/* ───────────────────────────── Auto-viz engine ───────────────────────────── */

type AutoViz =
  | { kind: "line"; series: any[]; xKey: "date" | "idx"; targetLabel: string }
  | { kind: "bar"; items: Array<{ name: string; value: number }>; targetLabel: string; cat: string }
  | { kind: "scatter"; points: Array<{ x: number; y: number }>; xName: string; yName: string; corr: number }
  | { kind: "hist"; bins: Array<{ bin: number; count: number }>; field: string; mean: number; median: number; min: number; max: number };

async function autoVizFromPreview(datasetId: string, q: string, fields: any): Promise<AutoViz | null> {
  const { rows, cols } = await getPreview(datasetId);
  if (!rows.length || !cols.length) return null;

  const qLower = q.toLowerCase();
  const dateKey = pickDateKey(cols);
  let filtered = filterRowsByTimeWindow(rows, dateKey, qLower);
  if (filtered.length < 10) filtered = rows;

  const numeric = pickNumericColumns(filtered, cols);
  const cat = bestCategoricalColumn(filtered, cols);

  const wantsScatter = /scatter|relationship|correlat|vs | versus | against /.test(qLower);
  const wantsHist = /distribution|histogram|spread|bins|quartile|variance|std dev|stddev|stdev/.test(qLower);
  const wantsBreakdown = /\b(which|top|most|best|largest|highest|biggest|contributed|share|breakdown|composition)\b/.test(qLower);

  const targetGuess =
    (typeof preferTarget === "function" ? (preferTarget(q, fields) as string | undefined) : undefined) ||
    numeric.find((c) => /revenue|sales|amount|profit|margin|qty|quantity|value|y$/i.test(c)) ||
    numeric[0];

  if (wantsHist && targetGuess) {
    const h = histogram(filtered, targetGuess, 24);
    if (h) return { kind: "hist", bins: h.bins, field: targetGuess, ...h.stats };
  }

  if (wantsBreakdown && cat) {
    if (targetGuess) {
      const items = topNBySum(filtered, cat, targetGuess, 12);
      if (items.length) return { kind: "bar", items, targetLabel: targetGuess, cat };
    }
    const itemsCount = topNCounts(filtered, cat, 12);
    if (itemsCount.length) return { kind: "bar", items: itemsCount, targetLabel: "Row count", cat };
  }

  if (wantsScatter || (!dateKey && numeric.length >= 2 && !wantsBreakdown)) {
    let best: { x: string; y: string; corr: number } | null = null;
    for (let i = 0; i < numeric.length; i++) {
      for (let j = i + 1; j < numeric.length; j++) {
        const xi = filtered.map((r) => toNumber(r[numeric[i]])).filter(Number.isFinite) as number[];
        const yi = filtered.map((r) => toNumber(r[numeric[j]])).filter(Number.isFinite) as number[];
        const rxy = pearson(xi, yi);
        if (!best || Math.abs(rxy) > Math.abs(best.corr)) best = { x: numeric[i], y: numeric[j], corr: rxy };
      }
    }
    if (best) {
      const points = filtered
        .map((r) => {
          const x = toNumber(r[best!.x]), y = toNumber(r[best!.y]);
          return Number.isFinite(x) && Number.isFinite(y) ? ({ x: x as number, y: y as number } as const) : null;
        })
        .filter(Boolean) as Array<{ x: number; y: number }>;
      if (points.length >= 10) return { kind: "scatter", points, xName: best.x, yName: best.y, corr: best.corr };
    }
  }

  if (dateKey && (targetGuess || numeric.length)) {
    const tgt = targetGuess || numeric[0];
    const map = new Map<string, number>();
    for (const r of filtered) {
      const d = parseDateLoose(r[dateKey]); if (!d) continue;
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const v = toNumber(r[tgt]); if (!Number.isFinite(v)) continue;
      map.set(ym, (map.get(ym) || 0) + (v as number));
    }
    const labels = Array.from(map.keys()).sort();
    if (labels.length) {
      const actual = labels.map((l) => map.get(l) || 0);
      const series = combineSeries(actual, [], labels);
      return { kind: "line", series, xKey: "date", targetLabel: tgt };
    }
  }

  if (numeric.length) {
    const h = histogram(filtered, numeric[0], 24);
    if (h) return { kind: "hist", bins: h.bins, field: numeric[0], ...h.stats };
  }
  return null;
}

// Extra safety: build *any* viz from preview if heuristics fail
async function quickPreviewAnyViz(datasetId: string, q: string, fields: any): Promise<AutoViz | null> {
  const { rows, cols } = await getPreview(datasetId);
  if (!rows.length || !cols.length) return null;

  const dateKey = pickDateKey(cols);
  const numeric = pickNumericColumns(rows, cols);
  const cat = bestCategoricalColumn(rows, cols);

  if (dateKey && numeric.length) {
    const tgt = numeric[0];
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = parseDateLoose(r[dateKey]); if (!d) continue;
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const v = toNumber(r[tgt]); if (!Number.isFinite(v)) continue;
      map.set(ym, (map.get(ym) || 0) + (v as number));
    }
    const labels = Array.from(map.keys()).sort();
    if (labels.length) {
      const actual = labels.map((l) => map.get(l) || 0);
      return { kind: "line", series: combineSeries(actual, [], labels), xKey: "date", targetLabel: tgt };
    }
  }

  if (cat && numeric.length) {
    const items = topNBySum(rows, cat, numeric[0], 12);
    if (items.length) return { kind: "bar", items, targetLabel: numeric[0], cat };
  }
  if (cat) {
    const items = topNCounts(rows, cat, 12);
    if (items.length) return { kind: "bar", items, targetLabel: "Row count", cat };
  }
  if (numeric.length) {
    const h = histogram(rows, numeric[0], 24);
    if (h) return { kind: "hist", bins: h.bins, field: numeric[0], ...h.stats };
  }
  return null;
}

/* ─────────────── Forecast fallback from preview (for “forecast” tasks) ─────────────── */

async function buildSeriesFromPreview(id: string, q: string, fields: any) {
  const p = await fetchJSON(`/api/data/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: id, limit: 2000 }),
  });
  const rows: any[] = Array.isArray(p?.rows) ? p.rows : [];
  if (!rows.length) return null;

  const columns: string[] = p?.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const isDateKey = (k: string) => /date|ds|day|month|week|period|timestamp|time/i.test(k);
  const dateKey = columns.find(isDateKey) || null;

  const numericCols = columns.filter((c) => rows.some((r) => toNumber(r[c]) !== undefined));
  const targetGuess =
    preferTarget(q, fields) ||
    numericCols.find((c) => /revenue|sales|amount|target|y|value/i.test(c)) ||
    numericCols[0];
  if (!targetGuess) return null;

  const qLower = q.toLowerCase();
  const granularity: "quarter" | "year" | "month" =
    /\bquarter\b/.test(qLower) ? "quarter" : /\byear\b/.test(qLower) ? "year" : "month";

  const labelFor = (d: Date) => {
    if (granularity === "quarter") {
      const qtr = Math.floor(d.getUTCMonth() / 3);
      const qStartMonth = qtr * 3;
      return new Date(Date.UTC(d.getUTCFullYear(), qStartMonth, 1)).toISOString().slice(0, 10);
    }
    if (granularity === "year") return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  };

  if (dateKey) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const raw = r[dateKey]; if (!raw) continue;
      const d = parseDateLoose(raw); if (!d) continue;
      const key = labelFor(d);
      const v = toNumber(r[targetGuess]); if (v == null) continue;
      map.set(key, (map.get(key) || 0) + v);
    }
    const labels = Array.from(map.keys()).sort((a, b) => +new Date(a) - +new Date(b));
    const actual = labels.map((l) => map.get(l) || 0);

    const w = Math.min(12, Math.max(3, Math.floor(actual.length / 6) || 3));
    const ma = new Array(actual.length).fill(null) as Array<number | null>;
    let s = 0;
    for (let i = 0; i < actual.length; i++) {
      s += actual[i];
      if (i >= w) s -= actual[i - w];
      if (i >= w - 1) ma[i] = s / w;
    }
    return { actual, forecast: ma, labels };
  } else {
    const actual = rows.map((r) => toNumber(r[targetGuess]) ?? 0);
    const labels = rows.map((_, i) => String(i + 1));
    const w = Math.min(12, Math.max(3, Math.floor(actual.length / 6) || 3));
    const ma = new Array(actual.length).fill(null) as Array<number | null>;
    let s = 0;
    for (let i = 0; i < actual.length; i++) {
      s += actual[i];
      if (i >= w) s -= actual[i - w];
      if (i >= w - 1) ma[i] = s / w;
    }
    return { actual, forecast: ma, labels };
  }
}

/* ───────────────────────── LLM explainability wrapper ───────────────────────── */

async function llmExplain(params: {
  mode: "forecast" | "drivers" | "viz";
  question: string;
  datasetId: string;
  target?: string | null;
  metrics?: { rmse?: number | null; mae?: number | null } | null;
  drivers?: Array<{ name: string; value: number }> | null;
  contextExtra?: string;
}) {
  const { mode, question, datasetId, target, metrics, drivers, contextExtra } = params;
  const ctx: string[] = [
    `Write 4–6 crisp business-friendly bullets (no jargon), audience is exec/product.`,
    target ? `Measure of interest: ${target}` : ``,
  ];
  if (mode === "forecast") {
    ctx.push(`If forecasting: summarize recent trend & seasonality; highlight near-term risk/opportunity.`);
    if (metrics && (metrics.rmse != null || metrics.mae != null)) {
      ctx.push(`Model quality (rough): RMSE=${metrics.rmse}, MAE=${metrics.mae}.`);
    }
  } else if (mode === "drivers") {
    ctx.push(`If drivers: list the strongest drivers and one actionable next step.`);
    if (drivers?.length) ctx.push(`Top drivers: ${drivers.slice(0, 8).map((d) => `${d.name}:${d.value.toFixed(3)}`).join(", ")}.`);
  } else {
    ctx.push(`If visualization: describe the visible pattern and add one concrete next step.`);
  }
  if (contextExtra) ctx.push(contextExtra);

  try {
    const r = await fetch("/api/explain/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, datasetId, context: ctx.filter(Boolean).join("\n") }),
    });
    if (!r.ok) throw new Error(`Explain HTTP ${r.status}`);
    const j = await r.json();
    const text = String(j?.answer || "");
    const bullets = text.split(/\n+/).map((s) => s.replace(/^[-•\s]+/, "").trim()).filter(Boolean).slice(0, 6);
    if (bullets.length >= 3) return bullets;
  } catch { /* fall back */ }

  const base = buildExplainability({
    question,
    task: mode === "forecast" ? ("forecast" as DetectedTask) : ("drivers" as DetectedTask),
    target: target || undefined,
    rmse: metrics?.rmse ?? undefined,
    mae: metrics?.mae ?? undefined,
  });
  return base;
}

/* ───────────────────────────── Types for history ───────────────────────────── */

type HistItem = {
  q: string;
  task: DetectedTask | "viz";
  bullets: string[];
  when: number;
  rmse?: number | null;
  mae?: number | null;
};

/* ───────────────────────────────── Component ───────────────────────────────── */

export default function PredictPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const qParam = sp.get("q") || "";
  const datasetParam = sp.get("dataset") || sp.get("id") || "";

  const [datasetId, setDatasetId] = useState<string>("");
  const [question, setQuestion] = useState<string>(qParam);
  const [nextQ, setNextQ] = useState<string>("");
  const [task, setTask] = useState<DetectedTask | "viz">(detectTask(qParam || ""));
  const [analyzing, setAnalyzing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // NEW: prevent stale runs from updating UI
  const runIdRef = useRef(0);

  const [fields, setFields] = useState<any>({});
  const [explain, setExplain] = useState<string[]>([]);
  const [history, setHistory] = useState<HistItem[]>([]);

  const [series, setSeries] = useState<any[]>([]);
  const [xKey, setXKey] = useState<"date" | "idx">("idx");
  const [metrics, setMetrics] = useState<{ rmse?: number | null; mae?: number | null }>({});
  const [drivers, setDrivers] = useState<Array<{ name: string; value: number }>>([]);
  const [viz, setViz] = useState<AutoViz | null>(null);

  useEffect(() => {
    const id = datasetParam || (typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetId") || "" : "");
    if (id) setDatasetId(id);
  }, [datasetParam]);

  useEffect(() => {
    if (!datasetId) return;
    fetchJSON(`/api/eds/summary/${encodeURIComponent(datasetId)}`)
      .then((s) => setFields(s?.fields || {}))
      .catch(() => {});
  }, [datasetId]);

  useEffect(() => {
    if (!datasetId || !question) return;
    run(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  async function run(q: string) {
    if (!datasetId || !q || analyzing) return;

    // increment run id & capture it locally
    const myRun = ++runIdRef.current;

    abortRef.current?.abort?.();
    const aborter = new AbortController();
    abortRef.current = aborter;

    setAnalyzing(true);
    setViz(null); // clear current viz to show progress state

    try {
      let detected = detectTask(q);
      if (myRun !== runIdRef.current) return;
      setTask(detected);

      // keep URL in sync (no scroll jump)
      const qs = new URLSearchParams();
      qs.set("dataset", datasetId);
      qs.set("q", q);
      qs.set("task", detected);
      router.replace(`/predict?${qs.toString()}`, { scroll: false });

      setDrivers([]); setExplain([]); setMetrics({}); setSeries([]);

      const target = preferTarget(q, fields);

      if (detected === "forecast") {
        let resp: any = null;
        try {
          resp = await fetchJSON(`/api/nlq/run`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: datasetId, question: q }),
            signal: aborter.signal,
          });
        } catch {}

        if (myRun !== runIdRef.current) return;

        let actual: Array<number | null> = resp?.actual ?? [];
        let forecast: Array<number | null> = resp?.forecast ?? [];
        let labels: string[] | undefined = resp?.labels;

        if ((!actual?.length && !forecast?.length) || !Array.isArray(actual) || !Array.isArray(forecast)) {
          try {
            const sum = await fetchJSON(`/api/eds/summary/${encodeURIComponent(datasetId)}`);
            if (myRun !== runIdRef.current) return;
            const arr = (sum?.trendCogsByMonth || sum?.trend || []) as Array<{ name: string; value: any }>;
            const trend = arr.map((d) => Number(d.value) || 0);
            const names = arr.map((d) => String(d.name));
            if (trend.length) {
              actual = trend;
              const w = Math.min(12, Math.max(3, Math.floor(trend.length / 6) || 3));
              const ma = new Array(trend.length).fill(null) as Array<number | null>;
              let s = 0;
              for (let i = 0; i < trend.length; i++) {
                s += trend[i];
                if (i >= w) s -= trend[i - w];
                if (i >= w - 1) ma[i] = s / w;
              }
              forecast = ma;
              labels = names;
            }
          } catch {}
        }

        if ((!actual?.length && !forecast?.length) || !Array.isArray(actual) || !Array.isArray(forecast)) {
          const fb = await buildSeriesFromPreview(datasetId, q, fields);
          if (myRun !== runIdRef.current) return;
          if (fb) { actual = fb.actual; forecast = fb.forecast; labels = fb.labels; }
        }

        const rows = combineSeries(actual || [], forecast || [], labels);
        if (myRun !== runIdRef.current) return;
        setXKey(rows.length && rows[0].date ? "date" : "idx");
        setSeries(rows);

        const m = { rmse: rmse(actual || [], forecast || []), mae: mae(actual || [], forecast || []) };
        setMetrics(m);

        const bullets = await llmExplain({
          mode: "forecast", question: q, datasetId, target, metrics: m, drivers: null,
        });
        if (myRun !== runIdRef.current) return;
        setExplain(bullets);
        setHistory((h) => [{ q, task: detected, bullets, when: Date.now(), rmse: m.rmse, mae: m.mae }, ...h].slice(0, 10));
      } else {
        // 1) Try smart auto-viz
        let av = await autoVizFromPreview(datasetId, q, fields);
        if (myRun !== runIdRef.current) return;

        // 2) If heuristics fail, force a viz from preview
        if (!av) {
          av = await quickPreviewAnyViz(datasetId, q, fields);
          if (myRun !== runIdRef.current) return;
        }

        if (av) {
          setTask("viz");
          setViz(av);

          let contextExtra = "";
          if (av.kind === "bar") {
            const top3 = av.items.slice(0, 3).map((d) => `${d.name}:${Math.round(d.value).toLocaleString()}`).join(", ");
            contextExtra = `Bar breakdown of ${av.targetLabel} by ${av.cat}. Top: ${top3}.`;
          } else if (av.kind === "scatter") {
            contextExtra = `Scatter of ${av.xName} vs ${av.yName}. Pearson r=${av.corr.toFixed(3)}.`;
          } else if (av.kind === "hist") {
            contextExtra = `Histogram of ${av.field}.`;
          } else if (av.kind === "line") {
            contextExtra = `Trend of ${av.targetLabel} (monthly).`;
          }

          const bullets = await llmExplain({ mode: "viz", question: q, datasetId, target, contextExtra });
          if (myRun !== runIdRef.current) return;
          setExplain(bullets);
          setHistory((h) => [{ q, task: "viz", bullets, when: Date.now() }, ...h].slice(0, 10));
          setAnalyzing(false);
          return;
        }

        // 3) Correlations fallback (still try to show something)
        let pretty: Array<{ name: string; value: number }> = [];
        try {
          const corrRes = await fetchJSONto(`/api/eds/corr/${encodeURIComponent(datasetId)}?top=12`, 4000).catch(() => null as any);
          if (myRun !== runIdRef.current) return;
          let items: any[] = [];
          if (Array.isArray(corrRes)) items = corrRes;
          else if (Array.isArray(corrRes?.items)) items = corrRes.items;
          else if (Array.isArray(corrRes?.top)) items = corrRes.top;
          else if (Array.isArray(corrRes?.pairs))
            items = corrRes.pairs.map((p: any) => ({ name: `${p.x ?? "X"}↔${p.y ?? "Y"}`, value: Number(p.corr) || 0 }));
          pretty = items.map((d: any) => ({
            name: d?.name || d?.column || d?.feature || "Feature",
            value: Number(d.value ?? d.corr ?? d.score ?? d.importance) || 0,
          }));
        } catch {}

        // FINAL safety net: preview -> simple bar/hist so a chart shows
        if (!pretty.length) {
          const forced = await quickPreviewAnyViz(datasetId, q, fields);
          if (myRun !== runIdRef.current) return;
          if (forced) {
            setTask("viz");
            setViz(forced);
            const bullets = await llmExplain({ mode: "viz", question: q, datasetId, target });
            if (myRun !== runIdRef.current) return;
            setExplain(bullets);
            setHistory((h) => [{ q, task: "viz", bullets, when: Date.now() }, ...h].slice(0, 10));
            setAnalyzing(false);
            return;
          }
        }

        setDrivers(pretty);
        const bullets = await llmExplain({ mode: "drivers", question: q, datasetId, target, metrics: null, drivers: pretty });
        if (myRun !== runIdRef.current) return;
        setExplain(bullets);
        setHistory((h) => [{ q, task: detected, bullets, when: Date.now() }, ...h].slice(0, 10));
      }
    } catch (e: any) {
      setExplain([`We couldn’t run the analysis. ${e?.message || ""}`]);
    } finally {
      if (myRun === runIdRef.current) setAnalyzing(false);
    }
  }

  function askNext() {
    if (!nextQ.trim()) return;
    setQuestion(nextQ.trim());
    setNextQ("");
    run(nextQ.trim());
  }
  function loadFromHistory(q: string) {
    setQuestion(q);
    run(q);
  }

  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="predict" />

      {/* query bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4 mb-4">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question (we pick the right analysis)…"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => run(question)}
            disabled={analyzing || !datasetId || !question}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
          >
            {analyzing ? "Running…" : "Run"}
          </button>
          <div className="text-xs text-zinc-500">
            Dataset: <span className="font-medium">{datasetId || "(none)"} </span> • Task:{" "}
            <span className="font-medium">{task}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* main panel */}
        <div className="col-span-12 xl:col-span-8 space-y-4">
          {task === "forecast" ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
              <div className="text-lg font-semibold mb-2">Forecast</div>
              {series?.length ? (
                <TimeSeries data={series} xKey={xKey} />
              ) : (
                <div className="text-sm text-zinc-500">
                  No forecastable series returned. Try a numeric target or another question.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                <Metric label="Model" value="Moving average (window≈auto)" />
                <Metric label="RMSE" value={metrics.rmse == null ? "—" : Number(metrics.rmse).toLocaleString()} />
                <Metric label="MAE" value={metrics.mae == null ? "—" : Number(metrics.mae).toLocaleString()} />
              </div>
            </div>
          ) : task === "viz" ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
              <div className="text-lg font-semibold mb-2">Visualization</div>
              {viz?.kind === "line" && <TimeSeries data={viz.series} xKey={viz.xKey} />}
              {viz?.kind === "bar" &&
                (viz.items.length <= 8 ? (
                  <DonutShare data={viz.items} topN={viz.items.length} />
                ) : (
                  <BarRank data={viz.items} />
                ))}
              {viz?.kind === "scatter" && <ScatterPlot data={viz.points} xName={viz.xName} yName={viz.yName} />}
              {viz?.kind === "hist" && <HistogramChart data={viz.bins} field={viz.field} />}

              {!viz && (
                <div className="text-sm text-zinc-500">
                  {analyzing ? "Working on visualization…" : "No suitable visualization found."}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
              <div className="text-lg font-semibold mb-2">Top drivers</div>
              {drivers?.length ? (
                drivers.length <= 6 ? <DonutShare data={drivers} topN={drivers.length} /> : <BarRank data={drivers} />
              ) : (
                <div className="text-sm text-zinc-500">No clear drivers found.</div>
              )}
            </div>
          )}
        </div>

        {/* right panel */}
        <div className="col-span-12 xl:col-span-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
            <div className="text-lg font-semibold mb-2">Explainability</div>
            {!explain.length ? (
              <div className="text-sm text-zinc-500">No explanation yet. Ensure Ollama is running, then click Run.</div>
            ) : (
              <ul className="list-disc ml-5 text-sm space-y-2">
                {explain.map((b, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} />
                ))}
              </ul>
            )}

            {/* Next question (stays on page) */}
            <div className="mt-4">
              <div className="text-sm font-medium mb-1">Next question</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
                  value={nextQ}
                  onChange={(e) => setNextQ(e.target.value)}
                  placeholder="e.g., Which channel contributed most last quarter?"
                />
                <button
                  onClick={askNext}
                  disabled={analyzing || !datasetId || !nextQ.trim()}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                >
                  Ask
                </button>
              </div>
            </div>

            {/* History */}
            {!!history.length && (
              <div className="mt-5">
                <div className="text-sm font-medium mb-1">History</div>
                <ul className="space-y-2">
                  {history.map((h, i) => (
                    <li key={i} className="text-sm">
                      <button
                        className="text-left w-full rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => loadFromHistory(h.q)}
                        title="Re-run this question"
                      >
                        <div className="font-medium">{h.q}</div>
                        <div className="text-xs text-zinc-500">
                          {new Date(h.when).toLocaleTimeString()} • {h.task}
                          {h.rmse != null || h.mae != null
                            ? ` • RMSE ${Math.round(h.rmse || 0).toLocaleString()} • MAE ${Math.round(h.mae || 0).toLocaleString()}`
                            : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-4">
              <button
                onClick={() => router.push(`/model?dataset=${encodeURIComponent(datasetId || "")}`)}
                className="px-3 py-1.5 rounded-lg border"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────── Inline mini-charts ─────────────────────────── */

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function BarRank({ data, topN = 12 }: { data: Array<{ name: string; value: number }>; topN?: number }) {
  const items = (data || []).slice(0, topN);
  if (!items.length) return <div className="text-sm text-zinc-500">No data</div>;
  const W = 920, H = 320, L = 180, R = 24, T = 20, B = 20;
  const max = Math.max(...items.map((d) => Math.abs(d.value))) || 1;
  const rowH = (H - T - B) / items.length;
  const bar = (v: number) => (Math.abs(v) / max) * (W - L - R);
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {items.map((d, i) => {
          const y = T + i * rowH + rowH * 0.15, h = rowH * 0.7, w = bar(d.value);
          const x = L;
          return (
            <g key={i}>
              <text x={L - 8} y={y + h / 2} fontSize="12" fill="#a1a1aa" textAnchor="end" dominantBaseline="central">
                {d.name}
              </text>
              <rect x={x} y={y} width={Math.max(1, w)} height={h} rx={4} fill="#60a5fa" opacity="0.9" />
              <text x={x + w + 6} y={y + h / 2} fontSize="12" fill="#a1a1aa" dominantBaseline="central">
                {Math.round(d.value).toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ScatterPlot({ data, xName, yName }: { data: Array<{ x: number; y: number }>; xName: string; yName: string }) {
  if (!data?.length) return <div className="text-sm text-zinc-500">No numeric pairs</div>;
  const W = 920, H = 420, P = 36;
  const xs = data.map((d) => d.x), ys = data.map((d) => d.y);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  const sx = (v: number) => P + ((v - mnx) / ((mxx - mnx) || 1)) * (W - 2 * P);
  const sy = (v: number) => H - P - ((v - mny) / ((mxy - mny) || 1)) * (H - 2 * P);
  const yTicks = niceTicks(mny, mxy, 6);
  const xTicks = niceTicks(mnx, mxx, 6);
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {yTicks.map((t, i) => (
          <g key={`gy${i}`}>
            <line x1={P} x2={W - P} y1={sy(t)} y2={sy(t)} stroke="#ffffff1a" strokeDasharray="4 6" />
            <text x={P - 8} y={sy(t)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="#a1a1aa">
              {fmtY(t, mny, mxy)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={`gx${i}`}>
            <line x1={sx(t)} x2={sx(t)} y1={P} y2={H - P} stroke="#ffffff0f" strokeDasharray="2 10" />
            <text x={sx(t)} y={H - P + 16} textAnchor="middle" fontSize="11" fill="#a1a1aa">
              {fmtY(t, mnx, mxx)}
            </text>
          </g>
        ))}
        {data.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill="#60a5fa" />)}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#a1a1aa">{xName}</text>
        <text x={12} y={12} textAnchor="start" fontSize="12" fill="#a1a1aa">{yName}</text>
      </svg>
    </div>
  );
}

function HistogramChart({ data, field }: { data: Array<{ bin: number; count: number }>; field: string }) {
  if (!data?.length) return <div className="text-sm text-zinc-500">No distribution</div>;
  const W = 920, H = 420, P = 36;
  const maxY = Math.max(...data.map((d) => d.count), 1);
  const bw = (W - 2 * P) / data.length;
  const yTicks = niceTicks(0, maxY, 6);
  const xLabelsCount = 6;
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {yTicks.map((t, i) => (
          <g key={`gy${i}`}>
            <line
              x1={P} x2={W - P}
              y1={H - P - (t / maxY) * (H - 2 * P)}
              y2={H - P - (t / maxY) * (H - 2 * P)}
              stroke="#ffffff1a" strokeDasharray="4 6"
            />
            <text
              x={P - 8}
              y={H - P - (t / maxY) * (H - 2 * P)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="#a1a1aa"
            >
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = P + i * bw, y = H - P - (d.count / maxY) * (H - 2 * P), hh = H - P - y;
          return <rect key={i} x={x} y={y} width={Math.max(1, bw - 2)} height={hh} rx={2} fill="#60a5fa" />;
        })}
        {data
          .filter((_, i) => i % Math.max(1, Math.floor(data.length / xLabelsCount)) === 0)
          .map((d, i2) => {
            const i = i2 * Math.max(1, Math.floor(data.length / xLabelsCount));
            const x = P + i * bw;
            return (
              <text key={`xl${i}`} x={x} y={H - P + 16} textAnchor="middle" fontSize="11" fill="#a1a1aa">
                {d.bin.toFixed(0)}
              </text>
            );
          })}
        <text x={W / 2} y={12} textAnchor="middle" fontSize="12" fill="#a1a1aa">
          Distribution of {field}
        </text>
      </svg>
    </div>
  );
}

function niceTicks(min: number, max: number, count = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const span = max - min, step = niceStep(span / Math.max(1, count));
  const start = Math.ceil(min / step) * step, end = Math.floor(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(v);
  if (!out.includes(0) && min < 0 && max > 0) out.push(0);
  return out.sort((a, b) => a - b);
}
function niceStep(step: number) {
  const pow = 10 ** Math.floor(Math.log10(step));
  const err = step / pow;
  if (err >= 7.5) return 10 * pow;
  if (err >= 3.5) return 5 * pow;
  if (err >= 1.5) return 2 * pow;
  return pow;
}
function fmtY(n: number, min: number, max: number) {
  const span = Math.abs(max - min);
  if (span < 10_000) return n.toLocaleString();
  if (span < 1_000_000) return (n / 1_000).toFixed(1) + "k";
  if (span < 1_000_000_000) return (n / 1_000_000).toFixed(1) + "M";
  return (n / 1_000_000_000).toFixed(1) + "B";
}
