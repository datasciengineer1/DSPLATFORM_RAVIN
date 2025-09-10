"use client";
import React, {useEffect, useState} from "react";
type Hit={question:string; cosine:number; sparse:number; rerank:number; combined:number};
type Weights={dense:number;sparse:number;cross:number};

function Meter({label,val,max=1}:{label:string;val:number;max?:number}) {
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  const color =
    label==="Cos"    ? "bg-sky-500"   :
    label==="Sparse" ? "bg-amber-500" :
    label==="Cross"  ? "bg-violet-500": "bg-zinc-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="w-10 text-[11px] text-zinc-400">{label}</div>
      <div className="h-2 bg-zinc-800 rounded w-full">
        <div className={`h-2 rounded ${color}`} style={{width:`${pct}%`}} />
      </div>
      <div className="w-12 text-[11px] tabular-nums text-zinc-400">{val.toFixed(3)}</div>
    </div>
  );
}

export default function CompactRetrieval({r}:{r?:{hits?:Hit[]; weights?:Weights; error?:string|null}}){
  const [detail,setDetail]=useState<boolean>(()=> typeof window!=="undefined" && localStorage.getItem("nlq:retrieval-detail")==="1");
  useEffect(()=>{ if (typeof window!=="undefined") localStorage.setItem("nlq:retrieval-detail", detail?"1":"0"); },[detail]);
  const hits=r?.hits||[];
  const W = r?.weights || {dense:0.5,sparse:0.3,cross:0.2};

  return (
    <div className="rounded-2xl border border-zinc-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Retrieval relevance</div>
        <button className="text-xs underline" onClick={()=>setDetail(d=>!d)}>{detail?'Compact':'Details'}</button>
      </div>

      <div className="flex gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700">Dense {W.dense.toFixed(2)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700">Sparse {W.sparse.toFixed(2)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700">Cross {W.cross.toFixed(2)}</span>
      </div>

      {r?.error && <div className="text-xs text-amber-400 mb-2">IR error: {r.error}</div>}
      {!hits.length && <div className="text-xs text-zinc-500">No candidates yet. Ask a question to populate.</div>}

      {!!hits.length && !detail && (
        <ul className="text-xs space-y-2">
          {hits.slice(0,5).map((h,i)=>(
            <li key={i} className="rounded-lg border border-zinc-800 p-2">
              <div className="mb-1 truncate">{h.question}</div>
              <div className="space-y-1">
                <Meter label="Cos"    val={h.cosine}/>
                <Meter label="Sparse" val={h.sparse}/>
                <Meter label="Cross"  val={h.rerank}/>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Combined</span><span className="tabular-nums">{h.combined.toFixed(3)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!!hits.length && detail && (
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="text-left">
              <th className="px-2 py-1">Candidate</th>
              <th className="px-2 py-1">Cos</th><th className="px-2 py-1">Sparse</th>
              <th className="px-2 py-1">Cross</th><th className="px-2 py-1">Combined</th>
            </tr></thead>
            <tbody>
              {hits.slice(0,20).map((h,i)=>(
                <tr key={i} className="border-t border-zinc-800 align-top">
                  <td className="px-2 py-1">{h.question}</td>
                  <td className="px-2 py-1">{h.cosine.toFixed(3)}</td>
                  <td className="px-2 py-1">{h.sparse.toFixed(3)}</td>
                  <td className="px-2 py-1">{h.rerank.toFixed(3)}</td>
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
