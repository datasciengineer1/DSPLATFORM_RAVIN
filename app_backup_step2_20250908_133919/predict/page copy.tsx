"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Markdown from "@/components/ui/Markdown";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

/* ----------------------------- helpers ----------------------------- */

function coerceNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function coerceArray(arr: any): Array<number | null> {
  return Array.isArray(arr) ? arr.map(coerceNum) : [];
}
function combineSeries(
  actual: Array<number | null> = [],
  forecast: Array<number | null> = []
) {
  const n = Math.max(actual.length, forecast.length);
  return Array.from({ length: n }, (_, i) => ({
    idx: i + 1,
    actual: Number.isFinite(actual[i] as number) ? (actual[i] as number) : null,
    forecast: Number.isFinite(forecast[i] as number)
      ? (forecast[i] as number)
      : null,
  }));
}
async function postJSON(path: string, body: any) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function fetchJSON(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function isObj(x: any) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function sample<T>(arr: T[], n = 50) {
  return arr.slice(0, n);
}
function movingAverage(arr: number[], window = 3): Array<number | null> {
  if (!arr?.length) return [];
  const w = Math.max(3, Math.min(12, window));
  const out: Array<number | null> = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) sum += v;
    if (i >= w && Number.isFinite(arr[i - w])) sum -= arr[i - w] as number;
    if (i >= w - 1) out[i] = sum / w;
  }
  return out;
}
function mae(a: (number | null)[], f: (number | null)[]) {
  let s = 0,
    n = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i],
      fv = f[i];
    if (Number.isFinite(av as number) && Number.isFinite(fv as number)) {
      s += Math.abs((fv as number) - (av as number));
      n++;
    }
  }
  return n ? s / n : null;
}
function rmse(a: (number | null)[], f: (number | null)[]) {
  let s = 0,
    n = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i],
      fv = f[i];
    if (Number.isFinite(av as number) && Number.isFinite(fv as number)) {
      s += Math.pow((fv as number) - (av as number), 2);
      n++;
    }
  }
  return n ? Math.sqrt(s / n) : null;
}
function safeYDomain(rows: any[]): [number, number] {
  const ys = rows
    .flatMap((d) => [d.actual, d.forecast])
    .filter((v): v is number => Number.isFinite(v as any));
  let min = ys.length ? Math.min(...ys) : 0;
  let max = ys.length ? Math.max(...ys) : 1;
  if (min === max) {
    min = min - 1;
    max = max + 1;
  }
  return [min, max];
}

/* --------- scan /api/predict/run response for any usable series --------- */
function pickSeriesLoose(resp: any): {
  labels: string[];
  actual: Array<number | null>;
  forecast: Array<number | null>;
} {
  if (!resp || typeof resp !== "object") return { labels: [], actual: [], forecast: [] };

  const roots = [resp, resp?.series, resp?.data, resp?.result].filter(Boolean);
  const getFirst = (keys: string[]) =>
    roots
      .map((o) => (o ? keys.find((k) => o?.[k] != null) : undefined))
      .map((k, i) => (k ? (roots[i] as any)[k] : undefined))
      .find((v) => v != null);

  let labels =
    (getFirst(["labels", "dates", "index", "timeline"]) as string[]) ?? [];
  let actual =
    coerceArray(
      getFirst([
        "actual",
        "y",
        "observed",
        "values",
        "actuals",
        "y_actual",
        "series_actual",
      ])
    ) ?? [];
  let forecast =
    coerceArray(
      getFirst([
        "forecast",
        "yhat",
        "prediction",
        "predictions",
        "y_pred",
        "pred",
        "series_forecast",
      ])
    ) ?? [];

  if (actual.length || forecast.length) return { labels, actual, forecast };

  // breadth-first search for any array of objects; pick first numeric column
  const queue: any[] = [...roots];
  const seen = new Set<any>();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur) && cur.length && isObj(cur[0])) {
      const rows = cur as Array<Record<string, any>>;
      const columns = Object.keys(rows[0]);
      const labelKey =
        columns.find((c) => /date|time|month|day/i.test(c)) ??
        columns.find((c) => typeof rows[0][c] === "string");
      const numericKey = columns.find((c) => {
        const vals = sample(rows.map((r) => r[c]), 80)
          .map(coerceNum)
          .filter((v) => v != null);
        return vals.length >= Math.max(5, Math.floor(rows.length * 0.2));
      });
      if (numericKey) {
        const a = rows.map((r) => coerceNum(r[numericKey]!));
        if (!labels.length && labelKey)
          labels = rows.map((r) => String(r[labelKey] ?? ""));
        const w = Math.min(12, Math.max(3, Math.floor(a.length / 6) || 3));
        const f = movingAverage(
          a.filter((v): v is number => v != null),
          w
        );
        const fAligned: Array<number | null> = new Array(a.length).fill(null);
        f.forEach((v, i) => {
          fAligned[i] = v;
        });
        return { labels, actual: a, forecast: fAligned };
      }
    }

    if (isObj(cur)) {
      Object.values(cur).forEach((v) => {
        if (v && typeof v === "object") queue.push(v);
      });
    }
  }
  return { labels: [], actual: [], forecast: [] };
}

/* ------------------------------ page ------------------------------ */

export default function PredictPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);

  const [q, setQ] = useState("What is the survival rate?");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<any>(null);

  // Fallback summary (for building a series if predict response has none)
  const [fallbackSummary, setFallbackSummary] = useState<any>(null);

  useEffect(() => {
    const fromUrl = sp.get("dataset") || sp.get("id");
    const sId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("currentDatasetId")
        : null;
    const sName =
      typeof window !== "undefined"
        ? sessionStorage.getItem("currentDatasetName")
        : null;

    if (fromUrl) {
      setDatasetId(fromUrl);
      setDatasetName(sName || null);
      return;
    }
    if (sId) {
      setDatasetId(sId);
      setDatasetName(sName || null);
      return;
    }
    setDatasetId("demo");
    setDatasetName("Sample: Retail (demo)");
  }, [sp]);

  async function run() {
    if (!datasetId) return;
    setLoading(true);
    setErr(null);
    try {
      const body = { id: datasetId, datasetId, question: q };
      const r = await postJSON("/api/predict/run", body);
      setRes(r);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to run prediction");
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  // Whenever result changes and contains no series, fetch EDA summary once.
  useEffect(() => {
    const { actual, forecast } = pickSeriesLoose(res ?? {});
    const hasSeries = (actual?.length ?? 0) || (forecast?.length ?? 0);
    if (!hasSeries && datasetId) {
      fetchJSON(`/api/eds/summary/${encodeURIComponent(datasetId)}`)
        .then((s) => setFallbackSummary(s))
        .catch(() => setFallbackSummary(null));
    }
  }, [res, datasetId]);

  /* -------------------- build chart rows robustly -------------------- */
  const synopsis = useMemo(() => {
    const question = res?.question || q;
    const target =
      res?.target ||
      res?.column ||
      res?.y_label ||
      "Revenue";

    // Try to extract series from /api/predict/run
    let { labels, actual, forecast } = pickSeriesLoose(res ?? {});
    let modelName = res?.model || "Moving average";

    // If nothing found, try EDA summary (trend or numeric distribution / preview)
    if (!(actual.length || forecast.length)) {
      const s = fallbackSummary ?? {};
      // preference order: any trend-like array of {name,value} → values by order
      const trendLike =
        s?.trendCogsByMonth ||
        s?.trendRevenueByMonth ||
        s?.trend ||
        null;

      if (Array.isArray(trendLike) && trendLike.length) {
        const vals = trendLike.map((d: any) => coerceNum(d?.value));
        const lbls = trendLike.map((d: any) => String(d?.name ?? ""));
        const cleanActual = vals;
        const w = Math.min(12, Math.max(3, Math.floor(vals.length / 6) || 3));
        const f = movingAverage(
          vals.filter((v): v is number => v != null),
          w
        );
        const fAligned: Array<number | null> = new Array(vals.length).fill(null);
        f.forEach((v, i) => {
          fAligned[i] = v;
        });
        actual = cleanActual;
        forecast = fAligned;
        labels = lbls;
        modelName = `Moving average (window=${w})`;
      } else if (Array.isArray(s?.distRevenue) && s.distRevenue.length) {
        // fall back to any numeric histogram
        const vals = s.distRevenue.map((d: any) => coerceNum(d?.value));
        const w = Math.min(12, Math.max(3, Math.floor(vals.length / 6) || 3));
        const f = movingAverage(
          vals.filter((v): v is number => v != null),
          w
        );
        const fAligned: Array<number | null> = new Array(vals.length).fill(null);
        f.forEach((v, i) => (fAligned[i] = v));
        actual = vals;
        forecast = fAligned;
        labels = s.distRevenue.map((d: any) => String(d?.name ?? ""));
        modelName = `Moving average (window=${w})`;
      } else if (Array.isArray(s?.preview) && s.preview.length && isObj(s.preview[0])) {
        // last resort: first numeric column from the preview table
        const rows: Array<Record<string, any>> = s.preview;
        const cols = Object.keys(rows[0]);
        const labelKey =
          cols.find((c) => /date|time|month|day/i.test(c)) ??
          cols.find((c) => typeof rows[0][c] === "string");
        const numKey = cols.find((c) => {
          const vals = sample(rows.map((r) => r[c]), 80)
            .map(coerceNum)
            .filter((v) => v != null);
          return vals.length >= Math.max(5, Math.floor(rows.length * 0.2));
        });
        if (numKey) {
          const vals = rows.map((r) => coerceNum(r[numKey]!));
          const w = Math.min(12, Math.max(3, Math.floor(vals.length / 6) || 3));
          const f = movingAverage(
            vals.filter((v): v is number => v != null),
            w
          );
          const fAligned: Array<number | null> = new Array(vals.length).fill(null);
          f.forEach((v, i) => (fAligned[i] = v));
          actual = vals;
          forecast = fAligned;
          labels = labelKey ? rows.map((r) => String(r[labelKey] ?? "")) : [];
          modelName = `Moving average (window=${w})`;
        }
      }
    }

    let rows = combineSeries(actual, forecast);
    if (Array.isArray(labels) && labels.length === rows.length) {
      rows = rows.map((d, i) => ({ ...d, date: String(labels[i] ?? "") }));
    }

    const hasDate =
      rows.length > 0 && "date" in rows[0] && rows.some((d: any) => d.date);
    const xKey = hasDate ? "date" : "idx";
    const yDomain = safeYDomain(rows);

    const calcRmse = rmse(actual, forecast);
    const calcMae = mae(actual, forecast);

    const explainText =
      res?.explain ||
      res?.summary ||
      `**Task:** Forecasting  
**Method:** ${modelName}  
**Target:** **${target}**  
**Interpretation:** Orange = forecast (moving-average level); blue = actual.`;

    const explainMd =
      `### Summary for: ${question}\n` +
      (explainText.endsWith("\n") ? explainText : explainText + "\n");

    const empty =
      !rows?.length ||
      (!rows.some((d: any) => d.actual != null) &&
        !rows.some((d: any) => d.forecast != null));

    return {
      question,
      target,
      rows,
      xKey,
      yDomain,
      rmse: coerceNum(res?.rmse) ?? calcRmse,
      mae: coerceNum(res?.mae) ?? calcMae,
      explainMd,
      modelName,
      empty,
    };
  }, [res, q, fallbackSummary]);

  return (
    <main className="container mx-auto px-4 py-6">
      {/* header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 mb-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">
          Dataset: <span className="font-medium">{datasetName ?? datasetId}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
            placeholder="Ask a question like “Forecast Revenue for the next 2 months”"
          />
          <button
            onClick={run}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
            disabled={loading || !datasetId}
          >
            {loading ? "Running..." : "Run"}
          </button>
        </div>
        {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      </div>

      {/* forecast + explainability */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
        <div className="text-lg font-semibold mb-3">{`Forecast of ${synopsis.target}`}</div>

        <div className="grid grid-cols-12 gap-4">
          {/* chart area */}
          <div className="col-span-12 lg:col-span-8">
            {synopsis.empty ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-10">
                No forecastable series returned. Try a numeric target or another question.
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={synopsis.rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={synopsis.xKey} />
                    <YAxis domain={synopsis.yDomain} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="actual"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      connectNulls
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="forecast"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      connectNulls
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* metric cards */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                <div className="uppercase tracking-wider">Model</div>
                <div className="font-medium">{synopsis.modelName}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                <div className="uppercase tracking-wider">RMSE</div>
                <div className="font-medium">
                  {synopsis.rmse != null ? Number(synopsis.rmse).toLocaleString() : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
                <div className="uppercase tracking-wider">MAE</div>
                <div className="font-medium">
                  {synopsis.mae != null ? Number(synopsis.mae).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* explainability panel (right) */}
          <div className="col-span-12 lg:col-span-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 h-full">
              <div className="text-sm font-semibold mb-2">Explainability</div>
              <Markdown>{synopsis.explainMd}</Markdown>
            </div>
          </div>
        </div>
      </div>

      {/* footer nav */}
      <div className="flex justify-end gap-2 mt-4">
        <Link
          href="/workspace"
          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          Back
        </Link>
        <Link
          href="/engineering"
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
        >
          Next
        </Link>
      </div>
    </main>
  );
}
