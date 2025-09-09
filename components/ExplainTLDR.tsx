"use client";
import React from "react";

export default function ExplainTLDR({ what, why, how }:{
  what?: string; why?: string; how?: string[] | undefined;
}){
  const howLine = (how && how.length) ? how.slice(0,2).join(" • ") : "—";
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm border border-zinc-700/30 rounded-lg">
        <thead className="bg-zinc-900/40">
          <tr className="text-left">
            <th className="px-3 py-2">What</th>
            <th className="px-3 py-2">Why</th>
            <th className="px-3 py-2">How (at a glance)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-zinc-800/60 align-top">
            <td className="px-3 py-2">{what || "—"}</td>
            <td className="px-3 py-2">{why || "—"}</td>
            <td className="px-3 py-2">{howLine}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
