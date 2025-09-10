"use client";
import React, { useEffect, useMemo, useState } from "react";
type Hit = { question:string; cosine?:number; sparse?:number; rerank?:number; combined?:number };
type Retrieval = { hits?: Hit[]; weights?: { dense:number; sparse:number; cross:number } };

function Chip({label,value}:{label:string; value:string}) {
  return <span className="px-2 py-0.5 rounded-full text-[11px] border bg-zinc-50/50 dark:bg-zinc-900/40">{label} {value}</span>;
}
function Bar({value}:{value:number}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="h-1.5 w-full rounded bg-zinc-200/60 dark:bg-zinc-800/80 overflow-hidden">
      <div className="h-full rounded" style={{width:`${pct}%`, background:"var(--accent, #3b82f6)"}} />
    </div>
  );
}

export default function CompactRetrieval({ r }: { r?: Retrieval }) {
  const [showTable,setShowTable]=useState<boolean>(()=> {
    if (typeof window==="undefined") return false;
    return localStorage.getItem("nlq:retrieval:details")==="1";
  });
  useEffect(()=>{ try{ localStorage.setItem("nlq:retrieval:details", showTable?"1":"0"); }catch{} },[showTable]);

  const weights = r?.weights || { dense:0.5, sparse:0.3, cross:0.2 };
  const hits = (r?.hits || []).slice(0, 6);

  const rows = useMemo(()=> {
    return hits.map(h=>{
      const c = Number.isFinite(h.cosine!) ? h.cosine! : 0;
      const s = Number.isFinite(h.sparse!) ? h.sparse! : 0;
      const x = Number.isFinite(h.rerank!) ? h.rerank! : 0;
      const combined = Number.isFinite(h.combined!) ? h.combined! : (c*weights.dense + s*weights.sparse + x*weights.cross);
      return { ...h, c, s, x, combined };
    });
  }, [hits, weights]);

  const max = (arr:number[])=>Math.max(1e-6, ...arr);
  const maxC = max(rows.map(d=>d.c)), maxS = max(rows.map(d=>d.s)), maxX = max(rows.map(d=>d.x)), maxComb = max(rows.map(d=>d.combined));

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Retrieval relevance</div>
        <button type="button" onClick={()=>setShowTable(v=>!v)} className="text-xs underline underline-offset-2">
          {showTable ? "Compact view" : "Details"}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-600 dark:text-zinc-300 mb-2">
        <span className="mr-1">Normalized weights:</span>
        <Chip label="Dense" value={weights.dense.toFixed(2)} />
        <Chip label="Sparse" value={weights.sparse.toFixed(2)} />
        <Chip label="Cross" value={weights.cross.toFixed(2)} />
      </div>

      {!rows.length && <div className="text-xs text-zinc-500">No candidates yet. Ask a question to populate.</div>}

      {!showTable && !!rows.length && (
        <div className="space-y-3">
          {rows.map((h,i)=>(
            <div key={i} className="border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-2">
              <div className="text-[12px] mb-1 line-clamp-2">{h.question}</div>
              <div className="grid grid-cols-4 gap-2 items-center">
                <div className="text-[11px] text-zinc-500">Cos {h.c.toFixed(3)}</div><Bar value={h.c / maxC} />
                <div className="text-[11px] text-zinc-500">Sparse {h.s.toFixed(3)}</div><Bar value={h.s / maxS} />
                <div className="text-[11px] text-zinc-500">Cross {h.x.toFixed(3)}</div><Bar value={h.x / maxX} />
                <div className="text-[11px] text-zinc-500">Combined {h.combined.toFixed(3)}</div><Bar value={h.combined / maxComb} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showTable && !!rows.length && (
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-50/40 dark:bg-zinc-900/30">
              <tr className="text-left">
                <th className="px-2 py-1">Candidate</th>
                <th className="px-2 py-1">Cos</th>
                <th className="px-2 py-1">Sparse</th>
                <th className="px-2 py-1">Cross</th>
                <th className="px-2 py-1">Combined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h,i)=>(
                <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-2 py-1">{h.question}</td>
                  <td className="px-2 py-1">{h.c.toFixed(3)}</td>
                  <td className="px-2 py-1">{h.s.toFixed(3)}</td>
                  <td className="px-2 py-1">{h.x.toFixed(3)}</td>
                  <td className="px-2 py-1">{h.combined.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
