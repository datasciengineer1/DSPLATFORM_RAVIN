"use client";
import React from "react";
import InfoTip from "./InfoTip";

type Weights = { dense:number; sparse:number; cross:number };

type Props = {
  dense:number; sparse:number; cross:number;
  onChange?: (w:Weights)=>void;
  onDense?: (n:number)=>void;
  onSparse?: (n:number)=>void;
  onCross?: (n:number)=>void;
};

export default function WeightsPanel({
  dense, sparse, cross, onChange, onDense, onSparse, onCross
}: Props) {

  const push = (w:Weights) => {
    onChange?.(w);
    onDense?.(w.dense);
    onSparse?.(w.sparse);
    onCross?.(w.cross);
  };

  const onD = (v:number)=> push({dense:clamp(v), sparse,           cross});
  const onS = (v:number)=> push({dense,           sparse:clamp(v), cross});
  const onC = (v:number)=> push({dense,           sparse,           cross:clamp(v)});

  return (
    <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center gap-1">
        <div className="text-sm font-semibold">Multi-vector Weights</div>
        <InfoTip title="How these weights are used">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Dense</b>: semantic cosine. Increase for natural-language questions.</li>
            <li><b>Sparse</b>: keyword/BM25. Boost when the query has IDs or exact terms.</li>
            <li><b>Cross-encoder</b>: precise re-ranking. Use ≥ 0.2 when precision matters.</li>
          </ul>
        </InfoTip>
      </div>

      {row("Dense",    dense,  onD)}
      {row("Sparse",   sparse, onS)}
      {row("Cross-enc",cross,  onC)}

      <p className="text-[11px] text-zinc-400">
        Tip: start Dense≈0.6; Sparse≈0.3 for ID-heavy queries; add Cross≥0.2 for best precision.
      </p>
    </div>
  );
}

function row(label:string, value:number, onChange:(v:number)=>void){
  return (
    <div className="grid grid-cols-[90px_1fr_50px] gap-2 items-center">
      <label className="text-sm">{label}:</label>
      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={(e)=>onChange(parseFloat(e.target.value))}
      />
      <input
        className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
        value={Number.isFinite(value) ? value.toFixed(2) : "0.00"}
        onChange={(e)=>{
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? clamp(n) : 0);
        }}
      />
    </div>
  );
}

function clamp(n:number){ return Math.max(0, Math.min(1, parseFloat(n as any))); }
