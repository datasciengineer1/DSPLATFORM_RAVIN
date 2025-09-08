"use client";
import React, { useEffect, useState } from "react";

type RetrievalDiag = {
  enabled: boolean;
  backend?: "node-wasm";
  embedder?: { name: string; dim: number; multilingual?: boolean };
  reranker?: { name?: string; enabled: boolean; error?: string };
  topk?: number;
  items?: Array<{ id: string; title?: string; embedScore: number; rerankScore?: number }>;
  metrics?: { ndcg_embed?: number; ndcg_rerank?: number };
  explain?: string[];
  error?: string;
};

async function fetchDiag(q: string, datasetId: string) {
  const res = await fetch("/api/diag/retrieval", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q, datasetId }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as RetrievalDiag;
}

export default function RetrievalTransparency({
  q, dataset, fallbackQ = "diagnostic query",
}: { q?: string; dataset?: string | null; fallbackQ?: string }) {
  const [diag, setDiag] = useState<RetrievalDiag | null>(null);

  useEffect(() => {
    const ds = dataset ?? (typeof window !== "undefined" ? sessionStorage.getItem("nlq.datasetId") : null);
    const qq = (q && q.trim()) || (typeof window !== "undefined" ? sessionStorage.getItem("nlq.question") || "" : "");
    if (!ds) { setDiag({ enabled:false, error:"no dataset" } as any); return; }
    fetchDiag(qq || fallbackQ, ds).then(setDiag).catch(() => setDiag(null));
  }, [q, dataset]);

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold mb-2">Retrieval transparency</h2>
      {!diag?.enabled ? (
        <div className="text-sm text-zinc-500">
          Disabled{diag?.error ? ` (${diag.error})` : " (start embeddings diag or install transformers.js)."}
        </div>
      ) : (
        <div className="text-sm space-y-2">
          <div>
            Embedder: <b>{diag.embedder?.name}</b> ({diag.embedder?.dim}d)
            {diag.embedder?.multilingual ? " · multilingual" : ""}
          </div>
          <div>
            Reranker:{" "}
            {diag.reranker?.enabled ? (
              <b>{diag.reranker?.name}</b>
            ) : (
              <span className="text-zinc-500">
                disabled{diag.reranker?.name ? ` (${diag.reranker?.name})` : ""}
                {diag.reranker?.error ? ` — ${diag.reranker?.error}` : ""}
              </span>
            )}
          </div>

          {!!diag.items?.length && (
            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr>
                    <th className="text-left p-2">Doc</th>
                    <th className="text-right p-2">embedScore</th>
                    <th className="text-right p-2">rerankScore</th>
                  </tr>
                </thead>
                <tbody>
                  {diag.items.slice(0, 5).map((it, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-2">{it.title}</td>
                      <td className="p-2 text-right">{it.embedScore.toFixed(3)}</td>
                      <td className="p-2 text-right">{it.rerankScore != null ? it.rerankScore.toFixed(3) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            {diag.metrics?.ndcg_embed != null && <span>nDCG (embed): {diag.metrics.ndcg_embed.toFixed(3)}</span>}
            {diag.metrics?.ndcg_rerank != null && <span>nDCG (rerank): {diag.metrics.ndcg_rerank.toFixed(3)}</span>}
          </div>

          {diag.explain?.length ? (
            <ul className="list-disc ml-5 text-xs text-zinc-500 space-y-1">
              {diag.explain.map((s,i)=>(
                <li key={i} dangerouslySetInnerHTML={{__html: s.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")}} />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
