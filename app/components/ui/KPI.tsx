"use client";
import React from "react";

export function KPI({
  label, value, delta
}: {
  label: string;
  value: string | number;
  delta?: { value: number; good?: boolean } | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {delta ? (
        <div className={"mt-1 text-xs " + (delta.good === false ? "text-rose-500" : "text-emerald-600")}>
          {delta.value > 0 ? "▲ " : delta.value < 0 ? "▼ " : ""}{Math.abs(delta.value)}%
        </div>
      ) : null}
    </div>
  );
}
