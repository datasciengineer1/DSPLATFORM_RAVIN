"use client";
import React from "react";

export default function SparkBars({
  dense = 0, sparse = 0, cross = 0, max,
  compact = false
}:{ dense:number; sparse:number; cross:number; max?:number; compact?:boolean }) {
  const M = max ?? Math.max(1, dense, sparse, cross);
  const pct = (x:number)=> `${Math.max(0, Math.min(100, (x/M)*100))}%`;
  const Row = ({label,val,cls}:{label:string;val:number;cls:string}) => (
    <div className={"flex items-center gap-2 " + (compact ? "text-[10px]" : "text-xs")}>
      <span className="w-14 shrink-0 text-zinc-500">{label}</span>
      <div className="h-2 bg-zinc-800/20 rounded w-full overflow-hidden">
        <div className={"h-2 rounded " + cls} style={{ width: pct(val) }} />
      </div>
      <span className="w-14 shrink-0 text-right tabular-nums">{val.toFixed(3)}</span>
    </div>
  );
  return (
    <div className={"space-y-1 " + (compact ? "py-0.5" : "py-1")}>
      <Row label="Dense"  val={dense}  cls="bg-blue-500" />
      <Row label="Sparse" val={sparse} cls="bg-violet-500" />
      <Row label="Cross"  val={cross}  cls="bg-emerald-500" />
    </div>
  );
}
