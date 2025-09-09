"use client";
import React from "react";

type Row = { kpi:string; dir:"up"|"down"|"flat"; mag:"low"|"med"|"high"; why:string };

function parseTable(md:string):Row[]{
  const m = md.match(/^\s*\|\s*KPI\s*\|\s*Direction[^|]*\|\s*Magnitude[^|]*\|\s*Why\s*\|[\s\S]*?(?:\n\s*\n|$)/im);
  if(!m) return [];
  const lines = m[0].split(/\r?\n/).filter(l=>/\|/.test(l)).slice(2); // skip header + divider
  const rows:Row[]=[];
  for(const ln of lines){
    const cells = ln.split("|").map(c=>c.trim());
    if(cells.length<5) continue;
    const kpi = cells[1]||"";
    const dir = (cells[2]||"").toLowerCase().includes("down")?"down":(cells[2]||"").toLowerCase().includes("up")?"up":"flat";
    const mag = (cells[3]||"").toLowerCase().includes("high")?"high":(cells[3]||"").toLowerCase().includes("med")?"med":"low";
    const why = cells[4]||"";
    if(kpi) rows.push({kpi,dir,mag,why});
  }
  return rows.slice(0,6);
}
const dot = (c:string)=> <i className="inline-block w-2 h-2 rounded-full" style={{background:c}}/>;
const arrow = (d:"up"|"down"|"flat") => d==="up"?"▲":d==="down"?"▼":"—";

export default function ImpactChips({ markdown }:{ markdown:string }){
  const rows = React.useMemo(()=>parseTable(markdown||""), [markdown]);
  if(!rows.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {rows.map((r,i)=>(
        <div key={i} className="px-2.5 py-1.5 rounded-full text-xs border border-zinc-200 dark:border-zinc-800">
          <span className="font-medium">{r.kpi}</span>{" "}
          <span className={r.dir==="up"?"text-emerald-500":r.dir==="down"?"text-red-500":"text-zinc-400"}>
            {arrow(r.dir)}
          </span>{" "}
          <span className={r.mag==="high"?"text-red-500":r.mag==="med"?"text-amber-500":"text-zinc-400"}>{r.mag}</span>
          <span className="mx-1">•</span>
          <span className="text-zinc-500">{r.why}</span>
        </div>
      ))}
    </div>
  );
}
