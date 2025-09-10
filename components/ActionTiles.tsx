"use client";
import React from "react";

type Item = { title: string; effort?: string; horizon?: string; tone?: "good"|"warn"|"info" };
type Group = { title: string; items: Item[] };
const toneCls = (t?:Item["tone"]) =>
  t==="good" ? "bg-emerald-500/10 text-emerald-300 border-emerald-600/40" :
  t==="warn" ? "bg-amber-500/10 text-amber-300 border-amber-600/40" :
               "bg-sky-500/10 text-sky-300 border-sky-600/40";

export default function ActionTiles({ groups}:{ groups: Group[] }) {
  if (!groups?.length) return null;
  return (
    <div className="mt-5 space-y-4">
      {groups.map((g,gi)=>(
        <div key={gi}>
          <div className="text-sm font-semibold mb-2">{g.title}</div>
          {!g.items?.length && <div className="text-xs text-zinc-400">No items.</div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.items?.map((it,ii)=>(
              <div key={ii} className={"rounded-xl border p-3 " + toneCls(it.tone)}>
                <div className="text-sm">{it.title}</div>
                {(it.effort || it.horizon) && (
                  <div className="mt-2 flex gap-2 text-[11px]">
                    {it.effort && <span className="px-2 py-0.5 rounded-full border border-zinc-600/40">{it.effort}</span>}
                    {it.horizon && <span className="px-2 py-0.5 rounded-full border border-zinc-600/40">{it.horizon}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
