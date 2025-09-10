"use client";
import React from "react";
type Strategy = {
  title: string;
  why?: string;
  how?: string;
  effort?: "low"|"med"|"high";
  horizon?: "short"|"mid"|"long";
};
function badge(c:string, text:string){ return <span className={`text-[10px] px-2 py-0.5 rounded-full ${c}`}>{text}</span>; }

export default function StrategyCards({items}:{items:Strategy[]|undefined}){
  if (!items?.length) return null;
  const colorEff = (e?:string)=> e==="low"?"bg-emerald-900/40 text-emerald-300 border border-emerald-700"
                       : e==="med"?"bg-amber-900/40 text-amber-300 border border-amber-700"
                       : "bg-rose-900/40 text-rose-300 border border-rose-700";
  const colorHor = (h?:string)=> h==="short"?"bg-sky-900/40 text-sky-300 border border-sky-700"
                        : h==="mid"?"bg-indigo-900/40 text-indigo-300 border border-indigo-700"
                        : "bg-purple-900/40 text-purple-300 border border-purple-700";
  return (
    <div className="mt-3 grid md:grid-cols-2 gap-3">
      {items.map((s,idx)=>(
        <div key={idx} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="flex gap-1">
              {badge(colorEff(s.effort), `effort: ${s.effort||"n/a"}`)}
              {badge(colorHor(s.horizon), `time: ${s.horizon||"n/a"}`)}
            </div>
          </div>
          {s.why && <div className="mt-2 text-xs text-zinc-400"><span className="font-medium text-zinc-300">Why: </span>{s.why}</div>}
          {s.how && <div className="mt-1 text-xs text-zinc-400"><span className="font-medium text-zinc-300">How: </span>{s.how}</div>}
        </div>
      ))}
    </div>
  );
}
