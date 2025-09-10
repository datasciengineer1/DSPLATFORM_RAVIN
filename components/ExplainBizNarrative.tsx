// components/ExplainBizNarrative.tsx
"use client";
import React, {useMemo} from "react";

type Row = {
  kpi?: string;
  direction?: "up"|"down"|"flat";
  magnitude?: "low"|"med"|"high";
  why?: string;
};

const magRank = {low:1, med:2, high:3};

export default function ExplainBizNarrative({impacts}:{impacts?: Row[]}) {
  const rows = impacts?.filter(Boolean) ?? [];
  const {up,down,flat} = useMemo(()=>{
    const up:Row[] = [], down:Row[] = [], flat:Row[] = [];
    for(const r of rows){
      if(r.direction==="up") up.push(r);
      else if(r.direction==="down") down.push(r);
      else flat.push(r);
    }
    up.sort((a,b)=>(magRank[b.magnitude||"low"]-magRank[a.magnitude||"low"]));
    down.sort((a,b)=>(magRank[b.magnitude||"low"]-magRank[a.magnitude||"low"]));
    return {up,down,flat};
  },[rows]);

  if(!rows.length) return null;

  const lead = (() => {
    if(down.length && !up.length) return "Key KPIs show negative pressure with limited offsetting positives.";
    if(up.length && !down.length) return "KPIs trend favorably with limited headwinds.";
    if(up.length && down.length) return "Mixed signals: both tailwinds and headwinds are present.";
    return "KPI signals are neutral overall.";
  })();

  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 p-4 bg-zinc-950/40">
      <div className="text-sm font-semibold mb-2">Executive summary (business)</div>
      <p className="text-sm mb-3">{lead} Use the model selection step to quantify magnitudes and forecast net effect.</p>

      {down.length>0 && (
        <section className="mb-3">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Headwinds</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {down.slice(0,5).map((r,i)=>(
              <li key={"d"+i}><b>{r.kpi}</b> — trending <b>down</b>{r.magnitude?` with ${r.magnitude} impact`:''}. {r.why||""}</li>
            ))}
          </ul>
        </section>
      )}

      {up.length>0 && (
        <section className="mb-3">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Tailwinds</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {up.slice(0,5).map((r,i)=>(
              <li key={"u"+i}><b>{r.kpi}</b> — trending <b>up</b>{r.magnitude?` with ${r.magnitude} impact`:''}. {r.why||""}</li>
            ))}
          </ul>
        </section>
      )}

      {flat.length>0 && (
        <section className="mb-3">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Stable/neutral</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {flat.slice(0,5).map((r,i)=>(
              <li key={"f"+i}><b>{r.kpi}</b> — currently <b>flat</b>. {r.why||""}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-3 gap-3 mt-2">
        <div className="rounded-xl border border-zinc-800 p-3">
          <div className="text-xs font-semibold mb-1">What it means</div>
          <p className="text-sm text-zinc-300">
            Combined KPI movement suggests near-term {down.length && magRank[down[0].magnitude||"low"]>= (up[0]?magRank[up[0].magnitude||"low"]:0) ? "pressure" : "stability"}.
            Monitor the strongest drivers to avoid surprises.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3">
          <div className="text-xs font-semibold mb-1">Why</div>
          <p className="text-sm text-zinc-300">
            The top “Why” drivers reflect operational levers (pricing, mix, COGS, demand).
            These are inferred from the dataset and similar historical questions.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3">
          <div className="text-xs font-semibold mb-1">How to act</div>
          <p className="text-sm text-zinc-300">
            Prioritize high-impact headwinds; strengthen tailwinds.
            Move to Model Selection to quantify deltas and test scenarios (e.g., cost control, promo mix, seasonality).
          </p>
        </div>
      </div>
    </div>
  );
}
