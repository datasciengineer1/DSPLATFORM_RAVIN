"use client";
import React from "react";
import Link from "next/link";
import { PanelCard } from "../components/SidePanels";

type Feature = { name: string; type: string; importance?: number; tags?: string[] };

export default function FeatureEngineeringPage() {
  // Replace with your actual catalog/store when ready
  const featureCatalog: Feature[] =
    (globalThis as any).__features ||
    [
      { name: "sales", type: "numeric", importance: 0.91, tags: ["target", "continuous"] },
      { name: "region", type: "categorical", importance: 0.42, tags: ["geo"] },
      { name: "month", type: "categorical", importance: 0.31, tags: ["time"] },
    ];

  return (
    <main className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feature Engineering</h1>
        <div className="flex gap-2">
          <Link href="/engineering" className="px-3 py-1.5 rounded-lg border">Back to Engineering</Link>
          <Link href="/nlq" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Continue to NLQ</Link>
        </div>
      </div>

      <PanelCard title="Feature Catalog">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {featureCatalog.map((f) => (
            <div key={f.name} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-zinc-500">{f.type}</div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(f.tags ?? []).map((t) => (
                    <span key={t} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {typeof f.importance === "number" ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                    <span>Importance</span><span>{Math.round(f.importance * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${Math.round(f.importance * 100)}%` }} />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button className="px-2 py-1 text-xs rounded-md border">One-Hot</button>
                <button className="px-2 py-1 text-xs rounded-md border">Scale</button>
                <button className="px-2 py-1 text-xs rounded-md border">Target Encode</button>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </main>
  );
}
