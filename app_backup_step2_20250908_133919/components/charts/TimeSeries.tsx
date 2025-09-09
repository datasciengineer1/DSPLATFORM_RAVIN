"use client";
import React, { useMemo } from "react";

type XKey = "date" | "idx";
export default function TimeSeries({ data, xKey }: { data: any[]; xKey: XKey }) {
  const W = 920, H = 420, P = 36;

  // ---- tolerant y key detection ----
  const yKeys = useMemo(() => {
    const row = data?.[0] ?? {};
    const pick = (cands: string[]) => cands.find(k => k in row) ?? null;
    return { yA: pick(["actual","a","y","value"]), yF: pick(["forecast","f","yhat","pred"]) };
  }, [data]);

  const rows = Array.isArray(data) ? data : [];

  // ---- normalize series ----
  const series = useMemo(() => {
    const out = rows.map((r, i) => ({
      x: xKey === "date" ? dateOrIdx(r?.date, i + 1) : (i + 1),
      a: toNum(yKeys.yA ? r[yKeys.yA] : undefined),
      f: toNum(yKeys.yF ? r[yKeys.yF] : undefined),
      rawDate: r?.date
    }));
    if (process.env.NODE_ENV !== "production") {
      try { console.debug("[TimeSeries] sample rows:", out.slice(0,3)); } catch {}
    }
    return out;
  }, [rows, yKeys, xKey]);

  const hasA = series.some(d => isNum(d.a));
  const hasF = series.some(d => isNum(d.f));
  if (!hasA && !hasF) {
    return <div className="text-sm text-zinc-500">No numeric points to plot.</div>;
  }

  // ---- domains & scales ----
  const ys = series.flatMap(d => [d.a, d.f]).filter(isNum) as number[];
  const ymin = Math.min(...ys, 0), ymax = Math.max(...ys, 1);
  const pad = (ymax - ymin) * 0.06 || 1;
  const Y0 = ymin - pad, Y1 = ymax + pad;

  const sxIdx = (v: number) => {
    const min = 1, max = Math.max(1, series.length);
    return P + ((v - min) / ((max - min) || 1)) * (W - 2 * P);
  };
  const sxDate = (d: Date) => {
    const xs = series.map(s => +(s.x instanceof Date ? s.x : new Date()));
    const min = Math.min(...xs), max = Math.max(...xs);
    return P + (((+d) - min) / ((max - min) || 1)) * (W - 2 * P);
  };
  const sx = (v: number | Date) => v instanceof Date ? sxDate(v) : sxIdx(v as number);
  const sy = (v: number) => H - P - ((v - Y0) / ((Y1 - Y0) || 1)) * (H - 2 * P);

  // ticks
  const yTicks = niceTicks(Y0, Y1, 6);
  const xTicks = (() => {
    if (!series.length) return [];
    if (xKey === "date" && series[0].x instanceof Date) {
      const xs = series.map(d => +(d.x as Date));
      const min = Math.min(...xs), max = Math.max(...xs);
      const step = (max - min) / 5;
      return Array.from({ length: 6 }, (_, i) => new Date(min + i * step));
    }
    const n = series.length, step = Math.max(1, Math.floor(n / 10));
    return Array.from({ length: Math.min(10, Math.ceil(n / step)) }, (_, i) => (i * step) + 1);
  })();

  // paths with gaps for nulls
  const buildPath = (key: "a" | "f") => {
    let started = false, d = "";
    for (const p of series) {
      const y = p[key];
      if (!isNum(y)) { started = false; continue; }
      const px = sx(p.x as any), py = sy(y as number);
      d += (started ? " L " : "M ") + `${px} ${py}`;
      started = true;
    }
    return d;
  };

  // distinct colors
  const colorActual   = "#60a5fa";  // blue
  const colorForecast = "#f59e0b";  // amber

  // choose label style: if range < 10k -> comma; else SI
  const fmtY = buildSmartFormatter(Y0, Y1);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* Y grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`gy${i}`}>
            <line x1={P} x2={W - P} y1={sy(t)} y2={sy(t)} stroke="#ffffff1a" strokeDasharray="4 6" />
            <text x={P - 8} y={sy(t)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="#a1a1aa">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {/* X grid + labels */}
        {xTicks.map((t, i) => {
          const tx = sx(t as any);
          return (
            <g key={`gx${i}`}>
              <line x1={tx} x2={tx} y1={P} y2={H - P} stroke="#ffffff0f" strokeDasharray="2 10" />
              <text x={tx} y={H - P + 16} textAnchor="middle" fontSize="11" fill="#a1a1aa">
                {t instanceof Date ? fmtMonth(t as Date) : String(t)}
              </text>
            </g>
          );
        })}

        {/* series */}
        {hasA && <path d={buildPath("a")} fill="none" stroke={colorActual} strokeWidth="2" />}
        {hasF && <path d={buildPath("f")} fill="none" stroke={colorForecast} strokeWidth="2" strokeDasharray="6 6" />}

        {/* legend */}
        <g transform={`translate(${P}, ${P - 12})`}>
          {hasA && <Legend color={colorActual} label="actual" x={0} />}
          {hasF && <Legend color={colorForecast} label="forecast" x={hasA ? 90 : 0} dashed />}
        </g>
      </svg>
    </div>
  );
}

function Legend({ color, label, x, dashed=false }:{color:string;label:string;x:number;dashed?:boolean}){
  return (
    <g transform={`translate(${x},0)`}>
      <line x1="0" x2="24" y1="0" y2="0" stroke={color} strokeWidth="3" strokeDasharray={dashed ? "6 6" : undefined}/>
      <text x="30" y="1" fontSize="12" fill="#a1a1aa" dominantBaseline="central">{label}</text>
    </g>
  );
}
function toNum(v:any){ const n=Number(v); return Number.isFinite(n) ? n : undefined; }
function isNum(v:any){ return typeof v === "number" && Number.isFinite(v); }
function dateOrIdx(val:any, idx:number){ const d=new Date(String(val)); return Number.isFinite(+d) ? d : idx; }

function niceTicks(min:number,max:number,count=6){
  if(!Number.isFinite(min)||!Number.isFinite(max)) return [0];
  if(min===max) return [min];
  const span=max-min, step=niceStep(span/Math.max(1,count));
  const start=Math.ceil(min/step)*step, end=Math.floor(max/step)*step;
  const out:number[]=[]; for(let v=start; v<=end+1e-9; v+=step) out.push(v);
  if(!out.includes(0) && min < 0 && max > 0) out.push(0);
  return out.sort((a,b)=>a-b);
}
function niceStep(step:number){
  const pow=10**Math.floor(Math.log10(step)); const err=step/pow;
  if(err>=7.5) return 10*pow; if(err>=3.5) return 5*pow; if(err>=1.5) return 2*pow; return pow;
}
function fmtMonth(d:Date){ const y=d.getUTCFullYear(); const m=String(d.getUTCMonth()+1).padStart(2,"0"); return `${y}-${m}`; }

// Smart formatter: commas for small ranges; SI for large; 1 decimal for SI
function buildSmartFormatter(min:number,max:number){
  const span = Math.abs(max - min);
  if (span < 10_000) return (n:number)=>n.toLocaleString();           // e.g., 8,531
  if (span < 1_000_000) return (n:number)=>(n/1_000).toFixed(1)+"k";   // e.g., 8.5k
  if (span < 1_000_000_000) return (n:number)=>(n/1_000_000).toFixed(1)+"M";
  return (n:number)=>(n/1_000_000_000).toFixed(1)+"B";
}
