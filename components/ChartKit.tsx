'use client';
import React from 'react';
import { pick } from '../lib/colors';

export function ChartGallery({ type, xField, yField, groupField, bins=20, data }:{
  type:string; xField?:string; yField?:string; groupField?:string; bins?:number; data:any[]
}){
  const cols = data && data[0] ? Object.keys(data[0]) : [];
  if (!data || !data.length || !cols.length) return <Empty label="No data for charts" />;
  const toNum = (v:any)=> { const n=Number(v); return Number.isFinite(n)? n: undefined; };

  const groupAgg=(rows:any[])=>{
    if(!xField) return [] as any[];
    const by = new Map<string, any[]>();
    rows.forEach(r=>{const k=String(r[xField!]); (by.get(k)||by.set(k,[]).get(k)!).push(r);});
    return Array.from(by.entries()).map(([k,arr])=>{
      if (!yField) return { x:k, v: arr.length };
      const ys = arr.map(a=>toNum(a[yField!])).filter(Boolean) as number[];
      const v  = ys.length? ys.reduce((a,b)=>a+b,0)/ys.length : 0;
      return { x:k, v };
    });
  };

  const mkHist=()=>{
    const field = xField || yField || cols[0];
    const xs = data.map(r=>toNum(r[field!])).filter(Boolean) as number[];
    if (!xs.length) return [] as any[];
    const k=bins||20, mn=Math.min(...xs), mx=Math.max(...xs), w=(mx-mn)/(k||1);
    const counts=Array.from({length:k},()=>0);
    xs.forEach(v=>{const idx=Math.min(Math.floor((v-mn)/w), counts.length-1); counts[idx]++;});
    return counts.map((c,i)=>({bin:(mn+i*w), count:c}));
  };

  if (type==='histogram') return <SVGHistogram data={mkHist()} labelX={xField||'value'} />;
  if (type==='scatter')   return <SVGScatter data={data} x={xField!} y={yField!} />;
  if (type==='pie')       return <SVGPie data={groupAgg(data)} />;
  if (type==='bubble')    return <SVGBubble data={data} x={xField!} y={yField!} g={groupField!} />;
  return <SVGBarOrLine kind={type} series={groupAgg(data)} labelX={xField||'category'} labelY={yField?`avg(${yField})`:'count'} />;
}
export function Empty({label}:{label:string}){return <div className="muted" style={{padding:16,textAlign:'center'}}>{label}</div>;}

// colored SVGs + axis labels
function SVGHistogram({data,labelX}:{data:any[];labelX:string}){ if(!data.length) return <Empty label="No histogram data"/>; const w=480,h=240,p=30; const maxY=Math.max(...data.map(d=>d.count)); const bw=(w-2*p)/data.length;
  return <svg viewBox={`0 0 ${w} ${h}`}>
    {data.map((d,i)=>{const x=p+i*bw,y=h-p-(d.count/maxY)*(h-2*p),hh=h-p-y;return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={hh} rx={2} fill={pick(i)}/>})}
    <text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">{labelX}</text>
    <text x={6} y={14} fontSize="12" fill="#555">count</text>
  </svg>;
}
function SVGScatter({data,x,y}:{data:any[];x:string;y:string}){ if(!data.length||!x||!y) return <Empty label="Select X & Y"/>; const w=480,h=240,p=30;
  const xs=data.map(r=>Number(r[x])).filter(Number.isFinite) as number[]; const ys=data.map(r=>Number(r[y])).filter(Number.isFinite) as number[]; if(!xs.length||!ys.length) return <Empty label="No numeric data"/>;
  const mnx=Math.min(...xs), mxx=Math.max(...xs), mny=Math.min(...ys), mxy=Math.max(...ys); const sx=(v:number)=>p+(v-mnx)/((mxx-mnx)||1)*(w-2*p); const sy=(v:number)=>h-p-(v-mny)/((mxy-mny)||1)*(h-2*p);
  return <svg viewBox={`0 0 ${w} ${h}`}>
    {data.map((r,i)=>{const xv=Number(r[x]);const yv=Number(r[y]); if(!Number.isFinite(xv)||!Number.isFinite(yv)) return null; return <circle key={i} cx={sx(xv)} cy={sy(yv)} r={3} fill={pick(i)}/>})}
    <text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">{x}</text>
    <text x={12} y={14} fontSize="12" fill="#555">{y}</text>
  </svg>;
}
function SVGPie({data}:{data:any[]}){ if(!data.length) return <Empty label="No data"/>; const entries=data.map((d:any)=>({k:d.x??d.k,v:d.v})).filter((d:any)=>Number.isFinite(d.v)); if(!entries.length) return <Empty label="No numeric values"/>;
  const tot=entries.reduce((a:any,b:any)=>a+b.v,0); const w=480,h=240,r=80,cx=w/2,cy=h/2; let start=0;
  return <svg viewBox={`0 0 ${w} ${h}`}>
    {entries.map((e:any,i:number)=>{const ang=(e.v/tot)*Math.PI*2; const end=start+ang; const large=ang>Math.PI?1:0; const x1=cx+r*Math.cos(start), y1=cy+r*Math.sin(start), x2=cx+r*Math.cos(end), y2=cy+r*Math.sin(end), d=`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`; const fill=pick(i); start=end; return <path key={i} d={d} fill={fill}/>})}
    <text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">share</text>
  </svg>;
}
function SVGBubble({data,x,y,g}:{data:any[];x:string;y:string;g:string}){ if(!data.length||!x||!y) return <Empty label="Select X & Y"/>; const w=480,h=240,p=30;
  const xs=data.map(r=>Number(r[x])).filter(Number.isFinite) as number[]; const ys=data.map(r=>Number(r[y])).filter(Number.isFinite) as number[]; const zs=data.map(r=>Number(r[g])).filter(Number.isFinite) as number[];
  if(!xs.length||!ys.length) return <Empty label="No numeric data"/>; const mnx=Math.min(...xs),mxx=Math.max(...xs),mny=Math.min(...ys),mxy=Math.max(...ys), mnz=zs.length?Math.min(...zs):0,mxz=zs.length?Math.max(...zs):1;
  const sx=(v:number)=>p+(v-mnx)/((mxx-mnx)||1)*(w-2*p); const sy=(v:number)=>h-p-(v-mny)/((mxy-mny)||1)*(h-2*p); const sr=(v:number)=>4+((v-mnz)/((mxz-mnz)||1))*10;
  return <svg viewBox={`0 0 ${w} ${h}`}>
    {data.map((r,i)=>{const xv=Number(r[x]);const yv=Number(r[y]);const zv=Number(r[g]); if(!Number.isFinite(xv)||!Number.isFinite(yv)) return null; return <circle key={i} cx={sx(xv)} cy={sy(yv)} r={Number.isFinite(zv)? sr(zv):6} fill={pick(i)} opacity={0.85}/>})}
    <text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">{x}</text>
    <text x={12} y={14} fontSize="12" fill="#555">{y} · size={g}</text>
  </svg>;
}
function SVGBarOrLine({kind,series,labelX,labelY}:{kind:string;series:any[];labelX:string;labelY:string}){ if(!series||!series.length) return <Empty label="No series"/>; const w=480,h=240,p=30; const maxY=Math.max(1,...series.map((d:any)=>Number(d.v)||0)); const bw=(w-2*p)/Math.max(series.length,1);
  if (kind==='line'){ const pts = series.map((d:any,i:number)=>{ const v=Number(d.v)||0; const x=p+i*bw; const y=h-p-(v/maxY)*(h-2*p); return `${x},${y}`}).join(' '); return <svg viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={pick(0)} strokeWidth="2"/>{series.map((d:any,i:number)=>{const v=Number(d.v)||0; const x=p+i*bw; const y=h-p-(v/maxY)*(h-2*p); return <circle key={i} cx={x} cy={y} r={3} fill={pick(i)}/>})}<text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">{labelX}</text><text x={12} y={14} fontSize="12" fill="#555">{labelY}</text></svg>; }
  return <svg viewBox={`0 0 ${w} ${h}`}>{series.map((d:any,i:number)=>{ const v=Number(d.v)||0; const x=p+i*bw; const y=h-p-(v/maxY)*(h-2*p); const hh=h-p-y; return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={hh} rx={2} fill={pick(i)}/>})}<text x={w/2} y={h-6} textAnchor="middle" fontSize="12" fill="#555">{labelX}</text><text x={12} y={14} fontSize="12" fill="#555">{labelY}</text></svg>;
}
