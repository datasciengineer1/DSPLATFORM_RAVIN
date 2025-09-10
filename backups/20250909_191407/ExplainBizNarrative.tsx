"use client";
import React from "react";

type Impact = { kpi:string; direction:"up"|"down"|"flat"; magnitude:"low"|"med"|"high"; why?:string };
export default function ExplainBizNarrative({impacts}:{impacts:Impact[]|undefined}){
  if (!impacts?.length) return null;

  const ups   = impacts.filter(i=>i.direction==="up");
  const downs = impacts.filter(i=>i.direction==="down");
  const scale = (m:"low"|"med"|"high") => m==="high"?"significant":m==="med"?"moderate":"small";

  const sentence = [
    ups.length   ? `Positive movement expected in ${ups.map(i=>i.kpi).join(", ")} with ${scale(ups[0].magnitude)} tailwinds.` : null,
    downs.length ? `Pressure likely on ${downs.map(i=>i.kpi).join(", ")} with ${scale(downs[0].magnitude)} headwinds.` : null,
  ].filter(Boolean).join(" ");

  return (
    <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="text-sm font-semibold mb-1">Business impact — in plain English</div>
      <p className="text-sm text-zinc-300">{sentence || "No material KPI shifts inferred yet."}</p>
      {!!ups.length && (
        <div className="mt-2 text-xs">
          <span className="font-medium text-emerald-400">Upside drivers</span>:{" "}
          {ups.map(i=>i.kpi).join(", ")}
        </div>
      )}
      {!!downs.length && (
        <div className="mt-1 text-xs">
          <span className="font-medium text-rose-400">Downside risks</span>:{" "}
          {downs.map(i=>i.kpi).join(", ")}
        </div>
      )}
    </div>
  );
}
