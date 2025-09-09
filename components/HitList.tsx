"use client";
import React from "react";

type Hit = {
  question:string;
  cosine:number; sparse:number; rerank:number;
  contributions?: { dense:number; sparse:number; cross:number; combined:number };
};

export default function HitList({ hits=[] as Hit[], max=7 }:{
  hits: Hit[]; max?: number;
}) {
  const top = hits.slice(0, max);
  return (
    <div className="space-y-2">
      {top.map((h, i) => {
        const dense = h.contributions?.dense ?? h.cosine ?? 0;
        const sparse = h.contributions?.sparse ?? h.sparse ?? 0;
        const cross = h.contributions?.cross ?? h.rerank ?? 0;
        const total = Math.max(1e-6, dense + sparse + cross);
        const wd = (dense/total)*100, ws = (sparse/total)*100, wc = (cross/total)*100;
        return (
          <div key={i} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            <div className="text-xs text-zinc-500 mb-1 line-clamp-2">{h.question}</div>
            <div className="h-2 w-full bg-zinc-900/10 dark:bg-zinc-100/10 rounded overflow-hidden flex">
              <div className="bg-sky-500"   style={{width:`${wd}%`}} />
              <div className="bg-violet-500" style={{width:`${ws}%`}} />
              <div className="bg-emerald-500"style={{width:`${wc}%`}} />
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 flex gap-3">
              <span>cos {(h.cosine??0).toFixed(3)}</span>
              <span>sparse {(h.sparse??0).toFixed(3)}</span>
              <span>cross {(h.rerank??0).toFixed(3)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
