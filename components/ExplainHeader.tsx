"use client";
import React from "react";

export default function ExplainHeader({
  category, confidence
}:{ category?:string; confidence?:"Low"|"Medium"|"High" }){
  const catStyle = "px-2 py-1 rounded-full text-xs border bg-zinc-50/50 dark:bg-zinc-900/40";
  const confStyle = (c?:string)=> c==="High"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : c==="Medium"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-rose-500/15 text-rose-400 border-rose-500/30";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={catStyle}>Category: <b className="ml-1">{category || "—"}</b></span>
      <span className={`px-2 py-1 rounded-full text-xs border ${confStyle(confidence)}`}>
        Confidence: <b className="ml-1">{confidence || "—"}</b>
      </span>
    </div>
  );
}
