"use client";
import React from "react";

export type KpiImpactRow = {
  kpi: string;
  direction: "up" | "down" | "neutral";
  magnitude?: "low" | "med" | "high" | "very high" | "unknown";
  why?: string;
};

export default function KpiImpactTable({ rows }: { rows?: KpiImpactRow[] }) {
  const data = rows || [];
  if (!data.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
        No KPI impacts detected yet.
      </div>
    );
  }

  const chip = (dir: KpiImpactRow["direction"]) => {
    if (dir === "up") return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800">▲ up</span>;
    if (dir === "down") return <span className="px-2 py-0.5 rounded-full text-xs bg-rose-900/40 text-rose-300 border border-rose-800">▼ down</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">– neutral</span>;
  };

  const magColor = (m?: string) =>
    m === "very high" ? "bg-rose-900/40 text-rose-300 border-rose-800"
    : m === "high" ? "bg-orange-900/40 text-orange-300 border-orange-800"
    : m === "med" ? "bg-amber-900/40 text-amber-300 border-amber-800"
    : m === "low" ? "bg-emerald-900/40 text-emerald-300 border-emerald-800"
    : "bg-zinc-800 text-zinc-300 border-zinc-700";

  return (
    <div className="overflow-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm bg-zinc-900">
        <thead className="text-zinc-300">
          <tr className="border-b border-zinc-800">
            <th className="text-left px-3 py-2 font-medium">KPI</th>
            <th className="text-left px-3 py-2 font-medium">Direction</th>
            <th className="text-left px-3 py-2 font-medium">Magnitude</th>
            <th className="text-left px-3 py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-t border-zinc-800 align-top">
              <td className="px-3 py-2 text-zinc-200">{r.kpi}</td>
              <td className="px-3 py-2">{chip(r.direction)}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${magColor(r.magnitude)}`}>
                  {r.magnitude || "unknown"}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-300">{r.why || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
