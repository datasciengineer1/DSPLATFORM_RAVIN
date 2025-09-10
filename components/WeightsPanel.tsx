"use client";
import React from "react";
export default function WeightsPanel({
  dense, sparse, cross, onChange
}:{ dense:number; sparse:number; cross:number; onChange?:(w:{dense:number;sparse:number;cross:number})=>void }) {
  const upd=(k:"dense"|"sparse"|"cross")=>(e:React.ChangeEvent<HTMLInputElement>)=>{
    const v = Math.max(0, Math.min(1, parseFloat(e.target.value)||0));
    onChange?.({ dense, sparse, cross, [k]: v } as any);
  };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
      <div className="font-semibold mb-2">Multi-Vector Weights</div>
      <label className="flex items-center gap-2 mb-2">
        <span className="w-16 text-zinc-300">Dense</span>
        <input type="number" step="0.05" min="0" max="1" value={dense} onChange={upd("dense")}
               className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"/>
      </label>
      <label className="flex items-center gap-2 mb-2">
        <span className="w-16 text-zinc-300">Sparse</span>
        <input type="number" step="0.05" min="0" max="1" value={sparse} onChange={upd("sparse")}
               className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"/>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-16 text-zinc-300">Cross</span>
        <input type="number" step="0.05" min="0" max="1" value={cross} onChange={upd("cross")}
               className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"/>
      </label>
    </div>
  );
}
