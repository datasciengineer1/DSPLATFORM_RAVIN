'use client';
import React, { useMemo } from 'react';

/** Small stat helpers */
const isNum = (v:any)=> typeof v==='number' && Number.isFinite(v);
const isISO = (v:any)=> typeof v==='string' && !Number.isNaN(+new Date(v));
function uniq<T>(a:T[]){ return Array.from(new Set(a)); }

function pickNumeric(columns:string[], rows:any[], want=2){
  const cols = columns.filter(c=> rows.some(r=> isNum(r?.[c]) ));
  return cols.slice(0,want);
}
function pickCategorical(columns:string[], rows:any[]){
  const cols = columns.filter(c=> rows.some(r=> !isNum(r?.[c]) && typeof r?.[c] !== 'object'));
  // prefer columns with low cardinality
  return cols.sort((a,b)=>{
    const ca = uniq(rows.map(r=>r?.[a]).filter(x=>x!=null)).length;
    const cb = uniq(rows.map(r=>r?.[b]).filter(x=>x!=null)).length;
    return ca - cb;
  })[0];
}
function pickDate(columns:string[], rows:any[]){
  return columns.find(c=> rows.some(r=> isISO(r?.[c]) ));
}

/** Mini charts (pure SVG – fast & dependency-free) */
function Card({title, subtitle, children}:{title:string;subtitle?:string;children:any}){
  return (
    <div className="card">
      <h2 style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>{title}</span>
        {subtitle && <span className="muted" style={{fontSize:12}}>{subtitle}</span>}
      </h2>
      <div className="body">{children}</div>
    </div>
  );
}

function Hist({values}:{values:number[]}){
  if(!values?.length) return <div className="muted">Need numeric field</div>;
  const bins=12;
  const min=Math.min(...values), max=Math.max(...values);
  const step=(max-min||1)/bins;
  const counts=Array(bins).fill(0);
  values.forEach(v=>{ let i=Math.floor((v-min)/step); if(i>=bins) i=bins-1; if(i<0) i=0; counts[i]++;});
  const H=counts, M=Math.max(...H,1);
  return (
    <svg viewBox="0 0 100 40" style={{width:'100%',height:160}}>
      {H.map((c,i)=><rect key={i} x={i*(100/bins)+1} y={40-(c/M)*38} width={(100/bins)-2} height={(c/M)*38} fill="#6b8aff" rx="1"/>)}
    </svg>
  );
}

function BarCounts({labels, counts}:{labels:string[]; counts:number[]}){
  if(!labels.length) return <div className="muted">Need categorical field</div>;
  const M=Math.max(...counts,1);
  return (
    <svg viewBox="0 0 100 40" style={{width:'100%',height:160}}>
      {counts.map((c,i)=><rect key={i} x={i*(100/counts.length)+1} y={40-(c/M)*38} width={(100/counts.length)-2} height={(c/M)*38} fill="#6b8aff" rx="1"/>)}
    </svg>
  );
}

function Pie({labels, counts}:{labels:string[];counts:number[]}){
  const total=counts.reduce((a,b)=>a+b,0)||1;
  let acc=0;
  const arcs = counts.map((c,i)=>{ const a0=acc/total*2*Math.PI; acc+=c; const a1=acc/total*2*Math.PI;
    const x0=50+40*Math.cos(a0), y0=50+40*Math.sin(a0);
    const x1=50+40*Math.cos(a1), y1=50+40*Math.sin(a1);
    const large = (a1-a0)>Math.PI?1:0;
    return <path key={i} d={`M50,50 L${x0},${y0} A40,40 0 ${large} 1 ${x1},${y1} Z`} fill={['#6b8aff','#93c5fd','#bdb4ff','#ffd580','#88d4a3','#f29cb2'][i%6]} opacity="0.9"/>;
  });
  return <svg viewBox="0 0 100 100" style={{width:'100%',height:160}}>{arcs}</svg>;
}

function Scatter({xs,ys}:{xs:number[];ys:number[]}){
  if(!xs.length||!ys.length) return <div className="muted">Need two numerics</div>;
  const minX=Math.min(...xs), maxX=Math.max(...xs); const minY=Math.min(...ys), maxY=Math.max(...ys);
  const mapX=(v:number)=> ( (v-minX)/(maxX-minX||1) )*100;
  const mapY=(v:number)=> 100 - ( (v-minY)/(maxY-minY||1) )*100;
  return (
    <svg viewBox="0 0 100 100" style={{width:'100%',height:160}}>
      {xs.map((x,i)=><circle key={i} cx={mapX(x)} cy={mapY(ys[i])} r="1.6" fill="#6b8aff" />)}
    </svg>
  );
}

function Line({xs, ys}:{xs:number[]; ys:number[]}){ // xs are time order
  if(!xs.length||!ys.length) return <div className="muted">Need date + numeric</div>;
  const minX=Math.min(...xs), maxX=Math.max(...xs); const minY=Math.min(...ys), maxY=Math.max(...ys);
  const p = xs.map((x,i)=>`${((x-minX)/(maxX-minX||1))*100},${100-((ys[i]-minY)/(maxY-minY||1))*100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" style={{width:'100%',height:160}}>
      <polyline points={p} fill="none" stroke="#6b8aff" strokeWidth="1.8"/>
    </svg>
  );
}

/** EDA grid (charts only) */
export default function EDACompact({rows, columns}:{rows:any[]; columns:string[];}){
  const sample = rows?.slice(0,500) ?? [];

  const [num1,num2] = pickNumeric(columns, sample, 2);
  const cat = pickCategorical(columns, sample);
  const dateCol = pickDate(columns, sample);

  const numVals1 = useMemo(()=> sample.map(r=>r?.[num1]).filter(isNum), [sample,num1]);
  const numVals2 = useMemo(()=> sample.map(r=>r?.[num2]).filter(isNum), [sample,num2]);

  const catLabelsCounts = useMemo(()=>{
    if(!cat) return {labels:[],counts:[] as number[]};
    const labels = uniq(sample.map(r=>r?.[cat]).filter((x:any)=>x!=null).map(String)).slice(0,8);
    const counts = labels.map(l=> sample.filter(r=> String(r?.[cat])===l).length );
    return {labels,counts};
  },[sample,cat]);

  const scatter = useMemo(()=>({
    xs: sample.map(r=>r?.[num1]).filter(isNum),
    ys: sample.map(r=>r?.[num2]).filter(isNum)
  }),[sample,num1,num2]);

  const line = useMemo(()=>{
    if(!dateCol || !num1) return {xs:[],ys:[]};
    const map = new Map<string, number[]>();
    for(const r of sample){
      const d=r?.[dateCol], v=r?.[num1];
      if(!isISO(d)||!isNum(v)) continue;
      const ym = new Date(d); const k = `${ym.getFullYear()}-${(ym.getMonth()+1).toString().padStart(2,'0')}`;
      if(!map.has(k)) map.set(k,[]);
      map.get(k)!.push(v);
    }
    const keys=[...map.keys()].sort();
    const xs = keys.map(k=> +new Date(k+'-01'));
    const ys = keys.map(k=> {
      const a=map.get(k)!; return a.reduce((s,n)=>s+n,0)/a.length;
    });
    return {xs,ys};
  },[sample,dateCol,num1]);

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
      <Card title={`Distribution of ${num1||'—'}`} subtitle="Spread & skew of values">
        <Hist values={numVals1} />
      </Card>

      <Card title={`Distribution of ${num2||'—'}`} subtitle="">
        <Hist values={numVals2} />
      </Card>

      <Card title={`Counts by ${cat||'—'}`} subtitle="Counts per category">
        <BarCounts labels={catLabelsCounts.labels} counts={catLabelsCounts.counts} />
      </Card>

      <Card title={`Share of ${cat||'—'}`} subtitle="Relative share">
        <Pie labels={catLabelsCounts.labels} counts={catLabelsCounts.counts} />
      </Card>

      <Card title={`${(num1&&num2)?`${num1} vs ${num2}`:'Scatter'}`} subtitle="Relationship, clusters, outliers">
        <Scatter xs={scatter.xs} ys={scatter.ys}/>
      </Card>

      <Card title={`Trend of ${num1||'—'} by Month`} subtitle="Trend over time">
        <Line xs={line.xs} ys={line.ys}/>
      </Card>
    </div>
  );
}
