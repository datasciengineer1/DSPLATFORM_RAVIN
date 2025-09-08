'use client';
import React, { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import AutoCharts from '../components/AutoCharts';
import DBConnector from '../components/DBConnector';
import Predictor from './Predictor';
import ExplainPanel from '../components/ExplainPanel';


async function postJSON(path:string, body:any){
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body??{})});
  if(!r.ok) throw new Error(`POST ${path} ${r.status}`); return r.json();
}

type Step = 1|2|3|4|5|6;
const LABEL: Record<Step,string> = {1:'Data',2:'EDA',3:'Fixes',4:'NLQ',5:'Model',6:'Predict/Explain'};
type ModelMode = 'auto' | 'manual';

function guessTargetFromNLQ(q:string, cols:string[], rows:any[], fallback:string){
  const L=(q||'').toLowerCase();
  const preferExact = ['target','label','outcome','result','survived','churn','default','fraud','win','loss','won','lost','success','approved','denied','active','inactive','converted'];
  for(const p of preferExact){ const c = cols.find(c=>c.toLowerCase()===p); if(c) return c; }
  for(const c of cols){ if(L.includes(c.toLowerCase())) return c; }

  // Avoid IDs
  const isId = (name:string)=> /(^id$|_id$|id$|uuid|guid|account|acct|number$|no$|code$)/i.test(name);

  // Binary categorical/boolean
  const colStats = cols.map(c=>{
    const vals = Array.from(new Set(rows.map((r:any)=>r[c]).filter((v:any)=>v!==null && v!==undefined)));
    return { c, k: vals.length, vals };
  });

  const binaryCat = colStats.find(s=> !isId(s.c) && s.k>0 && s.k<=2);
  if(binaryCat) return binaryCat.c;

  // Numeric 0/1
  const zeroOne = colStats.find(s=> !isId(s.c) && s.k>0 && s.k<=2 && s.vals.every((v:any)=>[0,1,'0','1',true,false].includes(v)));
  if(zeroOne) return zeroOne.c;

  // Last non-ID as fallback
  const nonId = [...cols].reverse().find(c=>!isId(c));
  return nonId || fallback;
}

export default function Workspace(){
  const [step,setStep]=useState<Step>(1);
  const [rows,setRows]=useState<any[]>([]);
  const [datasetId,setDatasetId]=useState<string>('demo:titanic');

  const [imputations,setImputations]=useState<Record<string,string>>({});
  const [oneHot,setOneHot]=useState(true);
  const [scaleNum,setScaleNum]=useState(false);

  const [nlq,setNlq]=useState(''); const [nlqRows,setNlqRows]=useState<any[]>([]);
  const [nlqLoading,setNlqLoading]=useState(false);
  const [target,setTarget]=useState<string>('');
  const [recs,setRecs]=useState<{name:string; why:string}[]>([]);
  const [chosen,setChosen]=useState<string>('');
  const [edaExplain,setEdaExplain]=useState<string>('—');
  const [predictExplain,setPredictExplain]=useState<string>('—');
  const [trainLoading,setTrainLoading]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [modelMode,setModelMode]=useState<ModelMode>('auto');
  const [predictRows,setPredictRows]=useState<any[]>([]);
  const [predictVersion,setPredictVersion]=useState(0);

  const flowSteps = ['Understanding question','Selecting target & model','Training model','Running predictions','Generating explanations'];
  const [flowVisible,setFlowVisible]=useState(false);
  const [flowStage,setFlowStage]=useState(0);

  const columns = useMemo(()=> rows[0]? Object.keys(rows[0]) : [], [rows]);

  function onLoaded(r:any[], meta:{source:string; id:string}){
    setRows(r||[]); setDatasetId(meta.id);
    // Full reset so nothing "Titanic" lingers
    setModelReady(false); (window as any).__train_metrics__=null;
    setPredictExplain('—'); setPredictRows([]); setNlqRows([]); setNlq('');
    if (r?.length) setStep(2);
  }

  useEffect(()=>{ // dataset switch -> reset view
    setModelReady(false); (window as any).__train_metrics__=null;
    setPredictExplain('—'); setPredictRows([]); setNlqRows([]); setNlq('');
  },[datasetId]);

  const engineered = useMemo(()=>{
    let out = rows.map(r=>({...r}));
    const cols = Object.keys(out[0]||{});
    const num = cols.filter(c=> out.every(x=>x[c]==null || typeof x[c]==='number'));
    const stats: Record<string, any> = {};
    for(const c of num){
      const xs = out.map(r=>r[c]).filter((x:any)=>x!=null) as number[];
      const m = xs.reduce((a,b)=>a+b,0)/(xs.length||1);
      const srt=[...xs].sort((a,b)=>a-b); const mid=Math.floor(srt.length/2);
      const med = srt.length? (srt.length%2? srt[mid] : (srt[mid-1]+srt[mid])/2) : m;
      const min = xs.length? Math.min(...xs):0, max = xs.length? Math.max(...xs):0;
      stats[c]={mean:m,median:med,min,max};
    }
    out = out.map(r=>{
      const o:any={...r};
      for(const c of cols){
        const rule = imputations[c]; if(o[c]==null && rule){
          const st=stats[c]||{};
          if(rule==='mean') o[c]=st.mean??o[c];
          if(rule==='median') o[c]=st.median??o[c];
          if(rule==='min') o[c]=st.min??o[c];
          if(rule==='max') o[c]=st.max??o[c];
          if(rule==='zero') o[c]=0;
        }
      } return o;
    });
    if(oneHot){
      const cats = cols.filter(c=> out.some(x=> typeof x[c]==='string'))
        .reduce((acc:Record<string,string[]>,c)=>{
          acc[c]=Array.from(new Set(out.map(r=>r[c]).filter((v:any)=>v!=null).map(String))).slice(0,6); return acc;
        },{});
      out = out.map(r=>{
        const o:any={...r}; for(const c of Object.keys(cats)){ for(const u of cats[c]) o[`${c}_${u}`]=(r[c]==null)?0:(String(r[c])===u?1:0); }
        return o;
      });
    }
    if(scaleNum){
      const all = Object.keys(out[0]||{}).filter(c=> out.every(x=>x[c]==null || typeof x[c]==='number'));
      const st:Record<string,{m:number;s:number}>={};
      for(const c of all){
        const xs = out.map(r=>r[c]).filter((x:any)=>x!=null) as number[];
        const m = xs.reduce((a,b)=>a+b,0)/(xs.length||1);
        const s = Math.sqrt(xs.reduce((a,b)=>a+(b-m)**2,0)/(xs.length||1))||1;
        st[c]={m,s};
      }
      out = out.map(r=>{ const o:any={...r}; for(const c of Object.keys(st)){ if(o[c]!=null) o[c]=(o[c]-st[c].m)/st[c].s; } return o;});
    }
    return out;
  },[rows,imputations,oneHot,scaleNum]);

  const autoTarget = useMemo(()=> guessTargetFromNLQ(nlq, columns, rows, columns[columns.length-1]||''),[nlq,columns,rows]);

  async function loadRecs(){
    const out = await fetch('/api/automl/recommend').then(x=>x.json()).catch(()=>({models:[]}));
    setRecs(out?.models||[]); if((out?.models?.length||0)>0) setChosen(out.models[0].name);
  }
  useEffect(()=>{ if(step===5 && !recs.length) loadRecs().catch(()=>{}); },[step]);

  useEffect(()=>{(async()=>{
    if(!columns.length) return;
    setEdaExplain('Processing…');
    try{
      const res = await postJSON('/api/explain/llm',{ context:'EDA overview', columns, charts:[{type:'auto',x:columns[0]}] });
      setEdaExplain(res?.text||'—');
    }catch{ setEdaExplain('—'); }
  })()},[datasetId, columns.length]);

  async function ensureModel(currentQuestion?:string){
    if(modelReady) return;
    setFlowVisible(true); setFlowStage(1); setTrainLoading(true);
    try{
      if(!recs.length) await loadRecs();
      const targetGuess = guessTargetFromNLQ(currentQuestion||'', columns, rows, autoTarget || target || columns[columns.length-1] || 'target');
      const model = chosen || recs[0]?.name || 'RandomForest';
      setFlowStage(2);
      const train = await postJSON('/api/automl/train', { datasetId, target:targetGuess, model });
      (window as any).__train_metrics__ = train?.metrics || null;
      setFlowStage(4);
      const exp  = await postJSON('/api/explain/llm', {
        context:`Trained ${train.modelId} on ${datasetId} with target ${targetGuess}`,
        columns, charts:[{type:'hist',x:columns[0]}],
        metrics:Object.entries(train.metrics||{}).map(([name,value])=>({name,value}))
      });
      setPredictExplain(exp?.text || '—');
      setModelReady(true);
    } finally { setTrainLoading(false); setTimeout(()=>setFlowVisible(false), 600); }
  }

  async function runNLQ(q:string, stayInPredict=false){
    setNlq(q); setNlqLoading(true);
    try{
      if(stayInPredict){ setFlowVisible(true); setFlowStage(0); }
      const r = await postJSON('/api/nlq',{ query:q, datasetId });
      setNlqRows(r?.rows||[]); setPredictRows(r?.rows||[]); setPredictVersion(v=>v+1);
      if (stayInPredict) { await ensureModel(q); setFlowStage(3); setStep(6); }
      else { setStep(5); }
    } finally { setNlqLoading(false); if(stayInPredict) setTimeout(()=>setFlowVisible(false), 800); }
  }

  async function doTrain(){
    setFlowVisible(true); setFlowStage(1); setTrainLoading(true);
    try{
      const targetGuess = modelMode==='auto'
        ? guessTargetFromNLQ(nlq, columns, rows, autoTarget || target || columns[columns.length-1] || 'target')
        : (target || autoTarget || columns[columns.length-1] || 'target');
      const model = modelMode==='auto' ? (recs[0]?.name || 'RandomForest') : (chosen || recs[0]?.name || 'RandomForest');
      setFlowStage(2);
      const train = await postJSON('/api/automl/train', { datasetId, target:targetGuess, model });
      (window as any).__train_metrics__ = train?.metrics || null;
      setFlowStage(4);
      const exp  = await postJSON('/api/explain/llm', {
        context:`Trained ${train.modelId} on ${datasetId} with target ${targetGuess}`,
        columns, charts:[{type:'hist',x:columns[0]}],
        metrics:Object.entries(train.metrics||{}).map(([name,value])=>({name,value}))
      });
      setPredictExplain(exp?.text || '—');
      setModelReady(true); setStep(6);
    } finally { setTrainLoading(false); setTimeout(()=>setFlowVisible(false), 600); }
  }

  function next(){ if (step===5) { void doTrain(); } else { setStep(Math.min(6,(step+1)) as Step); } }
  function prev(){ setStep(Math.max(1,(step-1)) as Step); }

  const summary = useMemo(()=>{
    const n = rows.length; const cols = columns.length;
    const miss:Record<string,number>={}; columns.forEach(c=>miss[c]=rows.filter(r=>r[c]==null).length);
    const numeric = columns.filter(c=> rows.every(r=>r[c]==null || typeof r[c]==='number'));
    const cat     = columns.filter(c=> !numeric.includes(c));
    const topMiss = Object.entries(miss).sort((a,b)=>b[1]-a[1]).slice(0,3);
    return {n, cols, numeric, cat, topMiss};
  },[rows,columns]);

  const explainText = step<=3 ? edaExplain : predictExplain;

  return (
    <main className="container">
      <div className="viewport">

        <div className="card"><h2>Workflow</h2>
          <div className="body" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[1,2,3,4,5,6].map((s)=>
              <button key={s} className="btn" style={{borderColor:s===step?'#2563eb':'#0002'}} onClick={()=>setStep(s as Step)}>{s}. {LABEL[s as Step]}</button>
            )}
          </div>
        </div>

        <div className="grid3-root">
          <div className="col left-pane stack">
          <ExplainPanel
    step={activeStep /* 1..6 */}
    rows={preview /* your EDA preview rows */}
    columns={columns}
    nlq={nlq}
  />
            <div className="card"><h2>Explainability</h2><div className="body"><div className="explain-box">{explainText}</div></div></div>
            <div className="card"><h2>Recommended</h2><div className="body">
              <div className="chip-list">
                {columns.length===0 ? <div className="muted">Load data to see suggestions.</div> :
                  (['Show overall distribution of key fields','Which categories dominate?','Any outliers in numerics?']
                  .concat([
                    `How does ${autoTarget || columns[0]} vary by ${columns[1]||columns[0]}?`,
                    `Is ${autoTarget || columns[0]} correlated with ${columns.find(c=>c!==(autoTarget||columns[0])) || columns[0]}?`
                  ])).map((q,i)=>
                    <button key={i} className="chip" onClick={()=>runNLQ(q, step===6)}>{q}</button>
                  )
                }
              </div>
            </div></div>
            <div className="card"><h2>Summary</h2><div className="body">
              <ul className="muted">
                <li>{summary.n} rows · {summary.cols} columns</li>
                <li>{summary.numeric.length} numeric · {summary.cat.length} categorical</li>
                <li>Most missing: {summary.topMiss.map(([c,n])=>`${c} (${n})`).join(', ') || '—'}</li>
              </ul>
            </div></div>
          </div>

          <div className="col center-pane">
            <div className="center-scroll">
              {step===1 && (<div className="card"><h2>1) Data</h2><div className="body"><div className="muted">Use the Properties panel to load a dataset.</div></div></div>)}
              {step===2 && (<div className="card"><h2>2) EDA</h2><div className="body">
                <AutoCharts rows={engineered}/>
                <h3 style={{margin:'8px 0'}}>Preview (15/pg)</h3>
                <div className="scroll-x"><DataTable rows={engineered} pageSize={15}/></div>
              </div></div>)}
              {step===3 && (<div className="card"><h2>3) Fixes</h2><div className="body" style={{display:'grid',gap:8}}>
                {columns.map(c=>(
                  <div key={c} style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:8,alignItems:'center'}}>
                    <div className="muted">{c}</div>
                    <select className="select" value={imputations[c]||''} onChange={e=>setImputations(s=>({...s,[c]:e.target.value}))}>
                      <option value="">— no fill —</option><option value="mean">mean</option><option value="median">median</option>
                      <option value="min">min</option><option value="max">max</option><option value="zero">0</option>
                    </select>
                  </div>
                ))}
                <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={oneHot} onChange={e=>setOneHot(e.target.checked)}/> One-hot encode</label>
                <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={scaleNum} onChange={e=>setScaleNum(e.target.checked)}/> Standardize numeric</label>
              </div></div>)}
              {step===4 && (<div className="card"><h2>4) NLQ</h2><div className="body" style={{display:'grid',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
                  <input className="input" placeholder="Ask a question…" value={nlq} onChange={e=>setNlq(e.target.value)}/>
                  <button className="btn" onClick={()=>runNLQ(nlq)} disabled={nlqLoading}>{nlqLoading?'Processing…':'Ask'}</button>
                </div>
                {!nlqLoading && nlqRows?.length>0 && (<><h3>Result</h3><div className="scroll-x"><DataTable rows={nlqRows} pageSize={15}/></div></>)}
              </div></div>)}
              {step===5 && (<div className="card"><h2>5) Model</h2><div className="body" style={{display:'grid',gap:12}}>
                <div className="segtabs">
                  <button className={`seg ${modelMode==='auto'?'active':''}`} onClick={()=>setModelMode('auto')}>AutoML (recommended)</button>
                  <button className={`seg ${modelMode==='manual'?'active':''}`} onClick={()=>setModelMode('manual')}>Manual override</button>
                </div>
                {modelMode==='auto' && (<div className="card"><h2>AutoML plan</h2><div className="body">
                  <ul className="muted"><li>Target: <strong>{autoTarget || columns[columns.length-1] || '—'}</strong></li>
                    <li>Model: <strong>{recs[0]?.name || 'RandomForest'}</strong></li></ul>
                  <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                    <button className="btn" onClick={doTrain} disabled={trainLoading}>{trainLoading?'Training…':'Train & Continue'}</button>
                  </div>
                </div></div>)}
                {modelMode==='manual' && (<>
                  {!recs.length? <div className="muted">Preparing recommendations…</div> :
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
                      {recs.map(m=>(
                        <div key={m.name} className="card" style={{borderColor:chosen===m.name?'#2563eb':'#0002',cursor:'pointer'}} onClick={()=>setChosen(m.name)}>
                          <h2>{m.name}</h2><div className="body"><div className="muted">{m.why}</div></div>
                        </div>
                      ))}
                    </div>}
                  <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'flex-end'}}>
                    <span className="muted">Target:</span>
                    <select className="select" style={{minWidth:200}} value={target} onChange={e=>setTarget(e.target.value)}>
                      <option value="">{autoTarget?`Auto: ${autoTarget}`:'—'}</option>
                      {columns.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <button className="btn" onClick={doTrain} disabled={!rows.length || (!chosen && !recs.length) || trainLoading}>
                      {trainLoading?'Training…':'Train & Continue'}
                    </button>
                  </div>
                </>)}
              </div></div>)}
              {step===6 && (<div className="card"><h2>6) Predict & Explain</h2><div className="body" style={{display:'grid',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
                  <input className="input" placeholder="Ask a new question…" value={nlq} onChange={e=>setNlq(e.target.value)}/>
                  <button className="btn" onClick={()=>runNLQ(nlq,true)}>{modelReady ? 'Ask' : 'Ask (auto-trains)'}</button>
                </div>
                <Predictor key={`${datasetId}:${predictVersion}`} rows={predictRows.length?predictRows:engineered} targetHint={autoTarget || target} question={nlq}/>
              </div></div>)}
            </div>
            {step!==5 && (<div className="step-cta"><div className="left muted">Step {step}: {LABEL[step]}</div>
              <div className="right"><button className="btn" onClick={prev} disabled={step===1}>Back</button><button className="btn" onClick={next} disabled={!rows.length}>{step===5?'Train & Continue':'Next'}</button></div></div>)}
          </div>

          <div className="col right-pane stack">
            <div className="card"><h2>Properties</h2><div className="body"><div className="muted">Dataset: <strong>{datasetId}</strong></div></div></div>
            <DBConnector onLoad={onLoaded}/>
          </div>
        </div>
      </div>

      {(trainLoading || flowVisible) && (
        <div className="overlay"><div className="overlay-box">
          <div style={{fontWeight:600}}>Working…</div>
          <div className="progress-steps">
            {['Understanding question','Selecting target & model','Training model','Running predictions','Generating explanations']
              .map((t,i)=><div className="step-row" key={i}><span className={i<flowStage?'step-dot done':i===flowStage?'step-dot active':'step-dot'}></span><span>{t}</span></div>)}
          </div>
        </div></div>
      )}
    </main>
  );
}
