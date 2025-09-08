'use client';
import React, { useMemo } from 'react';

export default function Predictor({ rows, targetHint, question }:{
  rows:any[]; targetHint?:string; question?:string;
}){
  const cols = useMemo(()=> (rows?.[0]? Object.keys(rows[0]) : []), [rows]);

  const metrics = (typeof window !== 'undefined' ? (window as any).__train_metrics__ : null) || {};
  const acc = metrics.accuracy ?? metrics.acc ?? null;
  const f1  = metrics.f1 ?? null;
  const auc = metrics.roc_auc ?? metrics.auc ?? null;

  return (
    <div className="card">
      <h2>6) Predict & Explain</h2>
      <div className="body" style={{display:'grid', gap:12}}>
        <div className="muted">
          {question ? <div><strong>Question:</strong> {question}</div> : null}
          {targetHint ? <div><strong>Target:</strong> {targetHint}</div> : null}
        </div>

        {/* Metrics */}
        <div className="card"><h3>Training metrics</h3>
          <div className="body">
            {acc || f1 || auc ? (
              <ul className="muted">
                {acc!=null && <li>Accuracy: {Number(acc).toFixed(3)}</li>}
                {f1 !=null && <li>F1: {Number(f1).toFixed(3)}</li>}
                {auc!=null && <li>ROC AUC: {Number(auc).toFixed(3)}</li>}
              </ul>
            ) : <div className="muted">Not available yet (click Train or use Ask (auto-train)).</div>}
          </div>
        </div>

        {/* Predicted rows */}
        <div className="card"><h3>Predictions (first 15)</h3>
          <div className="body">
            <div className="table-wrap">
              <table className="table">
                <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {(rows||[]).slice(0,15).map((r,i)=><tr key={i}>{cols.map(c=><td key={c}>{fmt(r?.[c])}</td>)}</tr>)}
                  {!rows?.length && <tr><td colSpan={cols.length||1} className="muted" style={{padding:16}}>No predictions yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Explainability text (LLM) */}
        <ExplainLLM rows={rows} question={question} />
      </div>
    </div>
  );
}

function ExplainLLM({rows,question}:{rows:any[]; question?:string}){
  const [text,setText]=React.useState<string>(''); const [busy,setBusy]=React.useState(false);
  async function gen(){
    setBusy(true);
    try{
      const j = await fetch('/api/explain/llm', {method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ question: question||'', rows: (rows||[]).slice(0,80) })}).then(r=>r.json()).catch(()=>({text:''}));
      setText(j?.text || '—');
    } finally { setBusy(false); }
  }
  return (
    <div className="card"><h3>Explainability (LLM)</h3>
      <div className="body" style={{display:'grid',gap:8}}>
        <button className="btn" onClick={gen} disabled={busy}>{busy?'Generating…':'Generate insights'}</button>
        <textarea className="input" rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder="Insights will appear here…"/>
      </div>
    </div>
  );
}

function fmt(v:any){
  if(v==null) return '—';
  if(typeof v==='number') return Number.isInteger(v)? String(v) : v.toFixed(3);
  if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0,10);
  return String(v);
}
