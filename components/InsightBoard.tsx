'use client';
import React, { useMemo } from 'react';

type Row = Record<string, any>;

function inferTypes(rows: Row[]){
  const cols = Object.keys(rows[0]||{});
  const numeric = cols.filter(c => rows.every(r=> r[c]==null || typeof r[c]==='number'));
  const categorical = cols.filter(c => !numeric.includes(c));
  const dateLike = cols.filter(c => /date|month|time/i.test(c));
  return {numeric, categorical, dateLike};
}

export default function InsightBoard({ rows, target }:{ rows: Row[], target?: string }){
  const { numeric, categorical, dateLike } = useMemo(()=>inferTypes(rows),[rows]);
  const firstCat = categorical[0]; const firstNum = numeric[0]; const firstDate = dateLike[0];

  // 1) Top categories
  const topCats = useMemo(()=>{
    if(!firstCat) return [];
    const m = new Map<string, number>();
    rows.forEach(r=>{ const k=String(r[firstCat]??'—'); m.set(k,(m.get(k)||0)+1); });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({k,v}));
  },[rows,firstCat]);

  // 2) Trend over time (if month/date)
  const trend = useMemo(()=>{
    if(!firstDate || !firstNum) return [];
    const m = new Map<string, {sum:number, n:number}>();
    rows.forEach(r=>{
      const d = String(r[firstDate]??''); const v = Number(r[firstNum]); if(!d || !Number.isFinite(v)) return;
      if(!m.has(d)) m.set(d,{sum:0,n:0}); const o=m.get(d)!; o.sum+=v; o.n++;
    });
    const arr = [...m.entries()].map(([d,o])=>({d, y:o.sum / (o.n||1)}))
      .sort((a,b)=> a.d.localeCompare(b.d));
    return arr.slice(0,60);
  },[rows,firstDate,firstNum]);

  // 3) Target by category (mean target per cat)
  const targetByCat = useMemo(()=>{
    if(!target || !firstCat) return [];
    const m = new Map<string, {sum:number, n:number}>();
    rows.forEach(r=>{
      const k=String(r[firstCat]??'—'); const t=Number(r[target]); if(!Number.isFinite(t)) return;
      if(!m.has(k)) m.set(k,{sum:0,n:0}); const o=m.get(k)!; o.sum+=t; o.n++;
    });
    return [...m.entries()].map(([k,o])=>({k, v:o.sum/(o.n||1)})).sort((a,b)=>b.v-a.v).slice(0,8);
  },[rows,target,firstCat]);

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
      <BarCard title={`Top ${firstCat||'category'}`} data={topCats} labelX={firstCat||'category'} labelY="count"
               caption="Largest categories in the current result set."/>
      <LineCard title={firstDate && firstNum ? `Trend of ${firstNum} by ${firstDate}` : 'Trend'}
                data={trend} labelX={firstDate||'time'} labelY={firstNum||'value'}
                caption="Time trend computed from the current results."/>
      <BarCard title={target && firstCat ? `${target} by ${firstCat}` : 'Target by category'}
               data={targetByCat} labelX={firstCat||'category'} labelY={target||'target'}
               caption="Average target by category to spot strong cohorts."/>
    </div>
  );
}

function BarCard({title,data,labelX,labelY,caption}:{title:string;data:{k:string,v:number}[];labelX:string;labelY:string;caption:string}){
  const w=240,h=160,p=24; const maxV=Math.max(1,...data.map(d=>d.v)); const bw=(w-2*p)/Math.max(1,data.length);
  return (
    <Card title={title} caption={caption}>
      {!data.length ? <div className="muted">No data</div> :
      <svg viewBox={`0 0 ${w} ${h}`}>
        {data.map((d,i)=>{ const x=p+i*bw; const y=h-p-(d.v/maxV)*(h-2*p);
          return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={h-p-y} fill="rgba(37,99,235,0.75)"/>})}
        <text x={w/2} y={h-6} textAnchor="middle" fontSize="10" fill="#555">{labelX}</text>
        <text x={6} y={12} fontSize="10" fill="#555">{labelY}</text>
      </svg>}
    </Card>
  );
}

function LineCard({title,data,labelX,labelY,caption}:{title:string;data:{d:string,y:number}[];labelX:string;labelY:string;caption:string}){
  const w=240,h=160,p=24;
  const maxY=Math.max(1,...data.map(d=>d.y)), minY=Math.min(0,...data.map(d=>d.y));
  const scaleX=(i:number)=> p + i*((w-2*p)/Math.max(1,data.length-1));
  const scaleY=(y:number)=> h-p - ( (y-minY)/(maxY-minY||1) )*(h-2*p);
  const pts = data.map((d,i)=>`${scaleX(i)},${scaleY(d.y)}`).join(' ');
  return (
    <Card title={title} caption={caption}>
      {!data.length ? <div className="muted">No data</div> :
      <svg viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2"/>
        <text x={w/2} y={h-6} textAnchor="middle" fontSize="10" fill="#555">{labelX}</text>
        <text x={6} y={12} fontSize="10" fill="#555">{labelY}</text>
      </svg>}
    </Card>
  );
}

function Card({title,children,caption}:{title:string;children:React.ReactNode;caption?:string}){
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="body">
        {children}
        {caption && <div className="chart-caption">{caption}</div>}
      </div>
    </div>
  );
}
