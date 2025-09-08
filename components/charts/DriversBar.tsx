"use client";
import React from "react";

export default function DriversBar({
  data,
  topN = 10,
  height = 280,
}: { data: Array<{name:string; value:number}>; topN?:number; height?:number }) {
  const items = (data || [])
    .filter(d => Number.isFinite(d.value))
    .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))
    .slice(0, topN);

  if (!items.length) {
    return <div className="text-sm text-zinc-500">No clear drivers found.</div>;
  }

  const W = 920, H = height, L = 180, R = 24, T = 20, B = 20;
  const max = Math.max(...items.map(d=>Math.abs(d.value))) || 1;
  const rowH = (H - T - B) / items.length;

  const bar = (v:number) => (Math.abs(v) / max) * (W - L - R);
  const fmt = (v:number) => Math.abs(v).toFixed(3);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {items.map((d, i) => {
          const y = T + i*rowH + rowH*0.15;
          const h = rowH*0.7;
          const w = bar(d.value);
          // left of origin for negative, right for positive
          const x0 = L + (d.value < 0 ? (W - L - R)/2 - w : (W - L - R)/2);
          const xAxis = L + (W - L - R)/2;

          return (
            <g key={i}>
              {/* center axis */}
              <line x1={xAxis} x2={xAxis} y1={T-8} y2={H-B+8} stroke="#ffffff14"/>
              {/* label */}
              <text x={L-8} y={y+h/2} fontSize="12" fill="#a1a1aa" textAnchor="end" dominantBaseline="central">
                {d.name}
              </text>
              {/* bar */}
              <rect x={x0} y={y} width={Math.max(1,w)} height={h} rx={4}
                    fill={d.value>=0 ? "#60a5fa" : "#f59e0b"} opacity="0.9" />
              {/* value */}
              <text x={x0 + (d.value>=0 ? w+6 : -6)} y={y+h/2} fontSize="12" fill="#a1a1aa"
                    textAnchor={d.value>=0 ? "start" : "end"} dominantBaseline="central">
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
        {/* headings */}
        <text x={L + (W - L - R)*0.25} y={T-6} fontSize="11" fill="#a1a1aa" textAnchor="middle">negative</text>
        <text x={L + (W - L - R)*0.75} y={T-6} fontSize="11" fill="#a1a1aa" textAnchor="middle">positive</text>
      </svg>
    </div>
  );
}
