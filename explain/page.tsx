'use client';
import React, { useEffect, useState } from 'react';
import { ChartGallery } from '../components/ChartKit';
import DataTable from '../components/DataTable';
async function fetchJSON(path:string){ const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw new Error(`GET ${path} ${r.status}`); return r.json(); }
async function postJSON(path:string, body:any){ const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}); if(!r.ok) throw new Error(`POST ${path} ${r.status}`); return r.json(); }
export default function ExplainPage(){
  const [preview, setPreview] = useState<any[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [fi, setFi] = useState<{feature:string;importance:number}[]>([]);
  const [narrative, setNarrative] = useState<string>('Generating narrative…');
  useEffect(()=>{(async()=>{
    const ds = await fetchJSON('/api/data/sources'); const id = ds?.[0]?.id;
    const p  = await postJSON('/api/data/preview',{name:id, limit:200}); setPreview(p?.rows??[]);
    const s  = await fetchJSON(`/api/eds/summary/${id}`); setCols(s?.columns ?? []);
    const shap = await postJSON('/api/explain/shap', { modelId: 'demo' }); setFi(shap?.featureImportances ?? []);
    const nar = await postJSON('/api/explain/llm', { columns: s?.columns, metrics: shap?.featureImportances }); setNarrative(nar?.text ?? '—');
  })().catch(()=>setNarrative('—'))},[]);
  return (
    <main className="container" style={{display:'grid', gap:12}}>
      <div className="card"><h2>Explainability Report</h2><div className="body"><p className="muted">{narrative}</p></div></div>
      <div className="card"><h2>Feature Importance (SHAP)</h2><div className="body">
        {fi?.length ? <ChartGallery type="bar" xField="feature" yField="importance" data={fi.map(d=>({feature:d.feature, importance:d.importance}))} /> : <div className="muted">No importances</div>}
      </div></div>
      <div className="card"><h2>Aggregate</h2><div className="body grid cols-3">
        <ChartGallery type="histogram" xField={cols[0]} data={preview}/>
        <ChartGallery type="pie"       xField={cols.find(c=>typeof preview?.[0]?.[c]==='string')||cols[0]} data={preview}/>
        <ChartGallery type="line"      xField={cols[0]} yField={cols.find(c=>typeof preview?.[0]?.[c]==='number')} data={preview}/>
      </div></div>
      <div className="card"><h2>Drill-down</h2><div className="body grid cols-3">
        <ChartGallery type="scatter" xField={cols.find(c=>typeof preview?.[0]?.[c]==='number')} yField={cols.find(c=>typeof preview?.[0]?.[c]==='number' && c!==cols[0])} data={preview}/>
        <ChartGallery type="bar"     xField={cols.find(c=>typeof preview?.[0]?.[c]==='string')||cols[0]} yField={cols.find(c=>typeof preview?.[0]?.[c]==='number')} data={preview}/>
        <ChartGallery type="bubble"  xField={cols.find(c=>typeof preview?.[0]?.[c]==='number')} yField={cols.find(c=>typeof preview?.[0]?.[c]==='number' && c!==cols[0])} groupField={cols.find(c=>typeof preview?.[0]?.[c]==='number' && c!==cols[0])} data={preview}/>
      </div></div>
      <div className="card"><h2>Records (sample)</h2><div className="body"><DataTable rows={preview} pageSize={20}/></div></div>
    </main>
  );
}
