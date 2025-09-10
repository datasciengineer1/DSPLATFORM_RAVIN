// components/StrategyCards.tsx
"use client";
import React from "react";

type Item = {
  title: string;
  effort?: "low"|"med"|"high";
  duration?: "short"|"med"|"long";
  kind?: "strategy"|"assumption"|"next";
};

function parseMeta(s: string) {
  const effort = /effort:\s*(low|med|high)/i.exec(s)?.[1]?.toLowerCase() as Item["effort"]|undefined;
  const duration = /\b(short|med|long)\b/i.exec(s)?.[1]?.toLowerCase() as Item["duration"]|undefined;
  // Strip the meta from the visible title
  const clean = s.replace(/·?\s*effort:\s*(low|med|high)/ig, "").replace(/·?\s*(short|med|long)\b/ig, "").replace(/\s{2,}/g," ").trim();
  return { effort, duration, clean };
}

function chipClass(e?: Item["effort"]) {
  switch(e){
    case "high": return "bg-red-500/15 text-red-300 border-red-600/30";
    case "med":  return "bg-amber-500/15 text-amber-300 border-amber-600/30";
    default:     return "bg-emerald-500/15 text-emerald-300 border-emerald-600/30"; // low/default
  }
}

export default function StrategyCards({items=[]}:{items:Item[]}) {
  if(!items.length) return null;
  // Parse inline meta if not provided
  const parsed = items.map(it=>{
    const {effort,duration,clean} = parseMeta(it.title);
    return {
      ...it,
      title: clean || it.title,
      effort: it.effort ?? effort ?? "low",
      duration: it.duration ?? duration ?? "short"
    };
  });

  return (
    <div className="mt-4">
      <div className="text-sm font-semibold mb-2">Strategies / Mitigation & Next steps</div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {parsed.map((it,idx)=>(
          <div key={idx} className={`rounded-xl border px-3 py-2 bg-zinc-950/40 border-zinc-800`}>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm font-medium">{it.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${chipClass(it.effort)}`}>
                effort: {it.effort}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Duration: <span className="uppercase">{it.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
