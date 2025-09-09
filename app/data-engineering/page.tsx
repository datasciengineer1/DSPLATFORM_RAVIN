"use client";
import React from "react";
import Link from "next/link";
import { PanelCard } from "../components/SidePanels";

type Summary = { name?: string; rows?: number; cols?: number; size_mb?: number; updatedAt?: string; };
type MissingInfo = {
  total_missing?: number;
  pct_missing?: number; // 0..100 or 0..1 — we normalize below
  by_column?: Array<{ column: string; missing: number; pct: number }>;
};
type DTypeInfo = Array<{ column: string; dtype: string; unique?: number }>;

export default function DataEngineeringPage() {
  // Wire these to your real store when ready:
  const summary: Summary = (globalThis as any).__eds_summary || {};
  const missing: MissingInfo = (globalThis as any).__eds_missing || { pct_missing: 0, total_missing: 0, by_column: [] };
  const dtypes: DTypeInfo = (globalThis as any).__eds_dtypes || [];
  const datasetName = summary?.name ?? "Dataset";

  const raw = missing?.pct_missing ?? 0;
  const missingPct = raw > 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10000) / 100; // always %
  const rowCount = summary?.rows ?? 0;
  const colCount = summary?.cols ?? dtypes.length ?? 0;

  return (
    <main className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Data Engineering</h1>
        <div className="flex gap-2">
          <Link href="/engineering" className="px-3 py-1.5 rounded-lg border">Back to Engineering</Link>
          <Link href="/nlq" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Continue to NLQ</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <PanelCard title="Rows"><div className="text-2xl font-semibold">{rowCount.toLocaleString()}</div></PanelCard>
        <PanelCard title="Columns"><div className="text-2xl font-semibold">{colCount}</div></PanelCard>
        <PanelCard title="Size (MB)"><div className="text-2xl font-semibold">{(summary?.size_mb ?? 0).toFixed(2)}</div></PanelCard>
        <PanelCard title="Missing (%)"><div className="text-2xl font-semibold">{missingPct}%</div></PanelCard>
      </div>

      <PanelCard title={`Data Quality — ${datasetName}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Overall Missing</div>
              <div className="text-sm text-zinc-500">{missingPct}%</div>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${missingPct}%` }} />
            </div>
            <p className="text-xs text-zinc-500 mt-2">Total missing cells: {(missing?.total_missing ?? 0).toLocaleString()}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="font-medium mb-2">Columns With Missing</div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="py-1">Column</th><th className="py-1">Missing</th><th className="py-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(missing?.by_column ?? []).map((r) => (
                    <tr key={r.column} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1">{r.column}</td>
                      <td className="py-1">{r.missing}</td>
                      <td className="py-1">{(r.pct > 1 ? r.pct : Math.round(r.pct * 10000) / 100)}%</td>
                    </tr>
                  ))}
                  {(!missing?.by_column || missing.by_column.length === 0) && (
                    <tr><td className="py-2 text-zinc-500" colSpan={3}>No missing values detected.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="Schema & Types">
        <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/30 sticky top-0">
              <tr className="text-left text-zinc-500"><th className="py-2 px-3">Column</th><th className="py-2 px-3">Type</th><th className="py-2 px-3">Unique</th></tr>
            </thead>
            <tbody>
              {( (dtypes ?? []) ).map((d) => (
                <tr key={d.column} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 px-3">{d.column}</td>
                  <td className="py-2 px-3">{d.dtype}</td>
                  <td className="py-2 px-3">{d.unique ?? "-"}</td>
                </tr>
              ))}
              {(!dtypes || dtypes.length === 0) && (
                <tr><td className="py-3 px-3 text-zinc-500" colSpan={3}>No dtype information available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </main>
  );
}
