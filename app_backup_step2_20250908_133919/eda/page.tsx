'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { toNumber, computeBinsStrict } from '@/utils/eda'; // <-- robust parsing + exact bins

async function fetchJSON(path: string) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return res.json();
}
async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`);
  return res.json();
}
function clsx(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(" "); }

interface DatasetSource { id:string; name:string; rows?:number; cols?:number }
interface NLQResult { sql:string; rows:any[] }
interface TrainResult { modelId:string; metrics:Record<string, number> }
interface ShapResult { featureImportances:Array<{feature:string; importance:number}> }

// -- helpers to normalize preview that may be array-rows
function rowsToObjects(rows:any[], columns?: string[]) {
  if (!rows || !rows.length) return [];
  if (!Array.isArray(rows[0])) return rows;
  const headers = (columns && columns.length) ? columns : rows[0].map((_:any, i:number)=>`c${i}`);
  return rows.map((arr:any[]) => {
    const o:any = {};
    for (let i=0;i<headers.length && i<arr.length;i++) o[headers[i]] = arr[i];
    return o;
  });
}

export default function EDA(){
  const [datasets,setDatasets]=useState<DatasetSource[]>([]);
  const [datasetId,setDatasetId]=useState('');
  const [preview,setPreview]=useState<any[]|null>(null);
  const [summary,setSummary]=useState<any|null>(null);
  const [missing,setMissing]=useState<any[]|null>(null);
  const [corr,setCorr]=useState<any[]|null>(null);
  const [target,setTarget]=useState('');
  const [nlq,setNlq]=useState('');
  const [nlqResult,setNlqResult]=useState<NLQResult|null>(null);
  const [training,setTraining]=useState(false);
  const [explaining,setExplaining]=useState(false);
  const [trainResult,setTrainResult]=useState<TrainResult|null>(null);
  const [shap,setShap]=useState<ShapResult|null>(null);
  const [chartType,setChartType]=useState('histogram');
  const [x,setX]=useState('');
  const [y,setY]=useState('');
  const [group,setGroup]=useState('');
  const [bins,setBins]=useState(20);
  const [log,setLog]=useState('');

  useEffect(()=>{(async()=>{
    try{
      const list=await fetchJSON('/api/data/sources');
      setDatasets(list);
      if(list?.length) setDatasetId(list[0].id);
    }catch(e:any){setLog(l=>l+`\n[data/sources] ${e.message}`)}
  })()},[]);

  useEffect(()=>{if(!datasetId)return;(async()=>{
    try{
      const p=await postJSON('/api/data/preview',{name:datasetId,limit:500}); // bigger sample
      setPreview(p?.rows??[]);
      if (!summary?.columns && p?.columns) setSummary((s:any)=>({...(s||{}), columns:p.columns}));
    }catch(e:any){setPreview([]);setLog(l=>l+`\\n[data/preview] ${e.message}`)}
    try{ setSummary(await fetchJSON(`/api/eds/summary/${encodeURIComponent(datasetId)}`)); }
    catch(e:any){ setLog(l=>l+`\\n[eds/summary] ${e.message}`) }
    try{
      const m=await fetchJSON(`/api/eds/missing/${encodeURIComponent(datasetId)}`);
      setMissing(Array.isArray(m)?m:[]);
    }catch(e:any){ setMissing([]); setLog(l=>l+`\\n[eds/missing] ${e.message}`)}
    try{
      const c=await fetchJSON(`/api/eds/corr/${encodeURIComponent(datasetId)}?top=20`);
      setCorr(Array.isArray(c)?c:(c?.items??[]));
    }catch(e:any){ setCorr([]); setLog(l=>l+`\\n[eds/corr] ${e.message}`)}
  })()},[datasetId]);

  const columns = useMemo(
    ()=> (preview && preview[0] ? Object.keys(preview[0]) : (summary?.columns ?? [])),
    [preview, summary]
  );

  const previewNorm = useMemo(
    ()=> rowsToObjects(preview ?? [], summary?.columns),
    [preview, summary]
  );

  async function runNLQ(){
    if(!datasetId||!nlq) return;
    try{
      setNlqResult(null);
      const r=await postJSON('/api/nlq',{query:nlq,datasetId});
      setNlqResult(r);
    }catch(e:any){
      setLog(l=>l+`\\n[NLQ] ${e.message}`);
    }
  }
  async function train(){
    if(!datasetId||!target){setLog(l=>l+`\\n[Train] Select target`);return;}
    try{
      setTraining(true);
      const r=await postJSON('/api/automl/train',{datasetId,target});
      setTrainResult(r);
    }catch(e:any){setLog(l=>l+`\\n[Train] ${e.message}`);}
    finally{setTraining(false);}
  }
  async function explain(){
    if(!trainResult?.modelId){setLog(l=>l+`\\n[Explain] Train first`);return;}
    try{
      setExplaining(true);
      const r=await postJSON('/api/explain/shap',{modelId:trainResult.modelId});
      setShap(r);
    }catch(e:any){setLog(l=>l+`\\n[Explain] ${e.message}`);}
    finally{setExplaining(false);}
  }

  return (<main className="container">
    <h1>EDA + NLQ</h1>
    <div className="card" style={{marginTop:12}}><h2>Workflow</h2><div className="body">
      <div className="row">
        <label style={{minWidth:80}}>Dataset</label>
        <select className="select" value={datasetId} onChange={e=>setDatasetId(e.target.value)}>
          {datasets.map(d=><option key={d.id} value={d.id}>{d.name||d.id}</option>)}
        </select>
        <label style={{minWidth:80}}>Target</label>
        <select className="select" value={target} onChange={e=>setTarget(e.target.value)}>
          <option value="">—</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn" onClick={train} disabled={training}>{training?'Training…':'Train'}</button>
        <button className="btn" onClick={explain} disabled={explaining}>{explaining?'Explaining…':'Explain'}</button>
      </div>
      <div style={{height:8}}/>
      <div className="row" style={{alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:280}}>
          <label>Ask in Natural Language</label>
          <textarea className="input" rows={2} placeholder="Which age group had maximum survivors?" value={nlq} onChange={e=>setNlq(e.target.value)}/>
        </div>
        <div style={{alignSelf:'end'}}><button className="btn" onClick={runNLQ}>Ask</button></div>
      </div>
    </div></div>

    <div className="card" style={{marginTop:12}}><h2>Table Preview</h2>
      <div className="body">{previewNorm?.length ? <DataTable rows={previewNorm}/> : <div className="muted">No preview</div>}</div>
    </div>

    <div className="card" style={{marginTop:12}}><h2>Exploratory Data Analysis</h2><div className="body">
      <div className="grid cols-3">
        <ChartCard title="Histogram" explanation={explainHistogram(previewNorm, x || columns[0], bins)}>
          <ChartGallery type="histogram" xField={x || columns[0]} yField={y} groupField={group} agg={'avg'} bins={bins} data={previewNorm} />
        </ChartCard>
        <ChartCard title="Scatter" explanation={explainScatter(previewNorm, x, y)}>
          <ChartGallery type="scatter" xField={x} yField={y} groupField={group} agg={'avg'} bins={bins} data={previewNorm} />
        </ChartCard>
        <ChartCard title="Line (agg)" explanation={explainLine(previewNorm, x, y)}>
          <ChartGallery type="line" xField={x} yField={y} groupField={group} agg={'avg'} bins={bins} data={previewNorm} />
        </ChartCard>
        <ChartCard title="Pie" explanation={explainPie(previewNorm, x, y)}>
          <ChartGallery type="pie" xField={x} yField={y} groupField={group} agg={'sum'} bins={bins} data={previewNorm} />
        </ChartCard>
        <ChartCard title="Bubble" explanation={explainBubble(previewNorm, x, y, group)}>
          <ChartGallery type="bubble" xField={x} yField={y} groupField={group} agg={'avg'} bins={bins} data={previewNorm} />
        </ChartCard>
        <ChartCard title="Bar (agg)" explanation={explainBar(previewNorm, x, y, group)}>
          <ChartGallery type="bar" xField={x} yField={y} groupField={group} agg={'sum'} bins={bins} data={previewNorm} />
        </ChartCard>
      </div>
      <details style={{marginTop:8}}><summary>Chart Controls</summary>
        <div className="grid cols-3" style={{marginTop:8}}>
          <div><label>X</label><select className="select" value={x} onChange={e=>setX(e.target.value)}><option value="">—</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label>Y</label><select className="select" value={y} onChange={e=>setY(e.target.value)}><option value="">—</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label>Group</label><select className="select" value={group} onChange={e=>setGroup(e.target.value)}><option value="">—</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label>Bins (hist)</label><input className="input" type="number" min={5} max={100} value={bins} onChange={e=>setBins(parseInt(e.target.value||'20'))}/></div>
        </div>
      </details>
    </div></div>

    <div className="card" style={{marginTop:12}}><h2>Log</h2><div className="body"><pre className="muted">{log||'(empty)'}</pre></div></div>
  </main>);
}

function Tile({title,description,action,onClick,disabled,meta}:{title:string;description:string;action:string;onClick:()=>void;disabled?:boolean;meta?:string[]}){
  return(<div className="card"><h2>{title}</h2><div className="body"><div className="muted">{description}</div><div style={{height:8}}/><button className="btn" onClick={onClick} disabled={disabled}>{action}</button>{meta&&<ul style={{marginTop:8}}>{meta.map((m,i)=><li key={i} className="muted">{m}</li>)}</ul>}</div></div>);
}
function DataTable({rows,compact=false}:{rows:any[];compact?:boolean}){
  if(!rows||!rows.length) return <div className="muted">No rows</div>;
  const cols=Object.keys(rows[0]||{});
  return(<div style={{overflow:'auto',border:'1px solid #0002',borderRadius:12}}><table className={clsx('table',compact&&'muted')}><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=>(<tr key={i}>{cols.map(c=><td key={c}>{fmt(r[c])}</td>)}</tr>))}</tbody></table></div>);
}
function fmt(v:any){if(v==null)return '';if(typeof v==='number')return Number.isInteger(v)?String(v):v.toFixed(3);return String(v);}
function ChartCard({title,explanation,children}:{title:string;explanation:string;children:React.ReactNode}){return(<div className="card"><h2>{title}</h2><div className="body"><div className="muted" style={{marginBottom:8}}>{explanation}</div>{children}</div></div>);}

// ---------- Charts ----------
function ChartGallery({type,xField,yField,groupField,agg,bins,data}:{type:string;xField:string;yField:string;groupField:string;agg:string;bins:number;data:any[]}){
  const cols=data&&data[0]?Object.keys(data[0]):[]; if(!data||!data.length||!cols.length) return <div className="muted">No data for charts</div>;
  function groupAgg(rows:any[]){ if(!xField) return[]; const by=new Map<string,any[]>(); for(const r of rows){const k=String(r[xField]);const arr=by.get(k)||[];arr.push(r);by.set(k,arr);} return Array.from(by.entries()).map(([k,arr])=>{ if(!yField)return{x:k,v:arr.length}; const ys=arr.map(a=>toNumber(a[yField])).filter((v):v is number=>v!==undefined); const v=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:0; return{x:k,v};});}
  function makeHist(){ const field=xField||yField||cols[0]; const values=(data.map(r=>toNumber(r[field]))).filter((v):v is number=>v!==undefined); if(!values.length)return[]; const b=computeBinsStrict(values, bins||20); return b.map(bb=>({bin:bb.x0,count:bb.count,label:`${bb.x0.toFixed(2)}–${bb.x1.toFixed(2)}`}));}
  if(type==='histogram')return <SVGHistogram data={makeHist()}/>;
  if(type==='scatter')return <SVGScatter data={data} x={xField} y={yField}/>;
  if(type==='pie')return <SVGPie data={groupAgg(data)}/>;
  if(type==='bubble')return <SVGBubble data={data} x={xField} y={yField} g={groupField}/>;
  return <SVGBarOrLine kind={type} series={groupAgg(data)}/>;
}
function SVGHistogram({data}:{data:any[]}){if(!data.length)return <div className="muted">No histogram data</div>;const w=480,h=220,p=24;const maxY=Math.max(...data.map(d=>d.count),1);const bw=(w-2*p)/data.length;return(<svg viewBox={`0 0 ${w} ${h}`}>{data.map((d,i)=>{const x=p+i*bw,y=h-p-(d.count/maxY)*(h-2*p),hh=h-p-y;return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={hh} rx={2} fill="currentColor"/>})}</svg>);}
function SVGScatter({data,x,y}:{data:any[];x:string;y:string}){if(!data.length||!x||!y)return <div className="muted">Select X and Y</div>;const w=480,h=220,p=24;const xs=data.map(r=>toNumber(r[x])).filter((v):v is number=>v!==undefined);const ys=data.map(r=>toNumber(r[y])).filter((v):v is number=>v!==undefined);if(!xs.length||!ys.length)return <div className="muted">No numeric data</div>;const mnx=Math.min(...xs),mxx=Math.max(...xs),mny=Math.min(...ys),mxy=Math.max(...ys);const sx=(v:number)=>p+(v-mnx)/((mxx-mnx)||1)*(w-2*p);const sy=(v:number)=>h-p-(v-mny)/((mxy-mny)||1)*(h-2*p);return(<svg viewBox={`0 0 ${w} ${h}`}>{data.map((r,i)=>{const xv=toNumber(r[x]);const yv=toNumber(r[y]);if(xv===undefined||yv===undefined)return null;return <circle key={i} cx={sx(xv)} cy={sy(yv)} r={3} fill="currentColor"/>})}</svg>);}
function SVGPie({data}:{data:any[]}){if(!data.length)return <div className="muted">No data</div>;const entries=data.map((d:any)=>({k:d.x??d.k,v:d.v})).filter(d=>Number.isFinite(d.v));if(!entries.length)return <div className="muted">No numeric values</div>;const total=entries.reduce((a,b)=>a+b.v,0);const w=480,h=220,r=80,cx=w/2,cy=h/2;let start=0;const arcs=entries.map((e,i)=>{const ang=(e.v/total)*Math.PI*2,end=start+ang,large=ang>Math.PI?1:0,x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start),x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end),d=`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;start=end;return{d,i}});return <svg viewBox={`0 0 ${w} ${h}`}>{arcs.map(a=><path key={a.i} d={a.d} fill="currentColor"/>)}</svg>;}
function SVGBubble({data,x,y,g}:{data:any[];x:string;y:string;g:string}){if(!data.length||!x||!y)return <div className="muted">Select X & Y</div>;const w=480,h=220,p=24;const xs=data.map(r=>toNumber(r[x])).filter((v):v is number=>v!==undefined);const ys=data.map(r=>toNumber(r[y])).filter((v):v is number=>v!==undefined);const zs=data.map(r=>toNumber(r[g])).filter((v):v is number=>v!==undefined);if(!xs.length||!ys.length)return <div className="muted">No numeric data</div>;const mnx=Math.min(...xs),mxx=Math.max(...xs),mny=Math.min(...ys),mxy=Math.max(...ys),mnz=zs.length?Math.min(...zs):0,mxz=zs.length?Math.max(...zs):1;const sx=(v:number)=>p+(v-mnx)/((mxx-mnx)||1)*(w-2*p);const sy=(v:number)=>h-p-(v-mny)/((mxy-mny)||1)*(h-2*p);const sr=(v:number)=>4+((v-mnz)/((mxz-mnz)||1))*10;return <svg viewBox={`0 0 ${w} ${h}`}>{data.map((r,i)=>{const xv=toNumber(r[x]);const yv=toNumber(r[y]);const zv=toNumber(r[g]);if(xv===undefined||yv===undefined)return null;return <circle key={i} cx={sx(xv)} cy={sy(yv)} r={(zv!==undefined)?sr(zv):6} fill="currentColor"/>})}</svg>;}
function SVGBarOrLine({kind,series}:{kind:string;series:any[]}){if(!series||!series.length)return <div className="muted">No series</div>;const w=480,h=220,p=24;const maxY=Math.max(1,...series.map((d:any)=>Number(d.v)||0));const bw=(w-2*p)/Math.max(series.length,1);return(<svg viewBox={`0 0 ${w} ${h}`}>{series.map((d:any,i:number)=>{const v=Number(d.v)||0;const x=p+i*bw;const y=h-p-(v/maxY)*(h-2*p);const hh=h-p-y;if(kind==='line')return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={2} rx={1} fill="currentColor"/>;return <rect key={i} x={x} y={y} width={Math.max(1,bw-2)} height={hh} rx={2} fill="currentColor"/>})}</svg>);}

function explainHistogram(data:any[]|null,field?:string,bins:number=20){if(!data||!data.length||!field)return"Histogram shows distribution of a numeric column.";const nums=data.map((r:any)=>toNumber(r[field])).filter((v):v is number=>v!==undefined);if(!nums.length)return`Histogram: ${field} is not numeric in preview.`;const mean=nums.reduce((a,b)=>a+b,0)/nums.length;const mn=Math.min(...nums),mx=Math.max(...nums);return`Histogram of ${field}. Range ${mn.toFixed(2)}–${mx.toFixed(2)}, mean ${mean.toFixed(2)}, ${bins} bins.`;}
function explainScatter(data:any[]|null,x?:string,y?:string){if(!x||!y)return"Scatter compares two numeric fields.";if(!data||!data.length)return`Scatter of ${x} vs ${y}.`;const xs=data.map((r:any)=>toNumber(r[x])).filter((v):v is number=>v!==undefined);const ys=data.map((r:any)=>toNumber(r[y])).filter((v):v is number=>v!==undefined);if(!xs.length||!ys.length)return`Scatter: ${x} or ${y} not numeric.`;return`Scatter of ${x} vs ${y}. Look for upward/downward trends or clusters.`;}
function explainLine(_data:any[]|null,x?:string,y?:string){if(!x||!y)return"Line aggregates Y by X to show trends.";return`Line of ${y} by ${x}. Useful for time series if ${x} is a date/period.`;}
function explainPie(_data:any[]|null,x?:string,y?:string){if(!x)return"Pie shows category shares.";return`Pie of ${x}${y?` by total ${y}`:' (count)'}.`;}
function explainBubble(_data:any[]|null,x?:string,y?:string,g?:string){return`Bubble: X=${x||'—'}, Y=${y||'—'}${g?`, bubble size from ${g}`:"."}`;}
function explainBar(_data:any[]|null,x?:string,y?:string,g?:string){return`Bar of ${y||'count'} by ${x||'category'}${g?` grouped by ${g}`:""}.`;}
