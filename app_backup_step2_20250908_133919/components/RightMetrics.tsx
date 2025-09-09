'use client';
import React from 'react';

function pickTruthKey(rows:any[]):string|undefined{
  const candidates=['survived','label','target','y','Indicator','indicator','Target'];
  const cols = rows[0]? Object.keys(rows[0]) : [];
  return candidates.find(c=> cols.includes(c));
}
function getPred(rows:any[]):{probKey?:string; predKey?:string}{
  const cols = rows[0]? Object.keys(rows[0]) : [];
  const probKey = ['__prob','prob','p1','p'].find(k=> cols.includes(k));
  const predKey = ['__pred','pred','yhat','prediction'].find(k=> cols.includes(k));
  return {probKey, predKey};
}

function computeCM(rows:any[], truthK?:string, predK?:string, probK?:string, thresh=0.5){
  if(!truthK) return null;
  const truth = (rows||[]).map(r=> Number(r?.[truthK]) );
  const pred  = (rows||[]).map(r=>{
    if(predK) return Number(r?.[predK]);
    if(probK) return Number(r?.[probK]) >= thresh ? 1 : 0;
    return NaN;
  });
  if(pred.some(v=>Number.isNaN(v))) return null;
  let tn=0, fp=0, fn=0, tp=0;
  for(let i=0;i<truth.length;i++){
    const t=truth[i], p=pred[i];
    if(t===0&&p===0) tn++; else if(t===0&&p===1) fp++;
    else if(t===1&&p===0) fn++; else if(t===1&&p===1) tp++;
  }
  return [[tn,fp],[fn,tp]];
}

function computeROC(rows:any[], truthK?:string, probK?:string){
  if(!truthK||!probK) return null;
  const pts = rows.map(r=>({y:+r[truthK], p:+r[probK]})).filter(x=>!Number.isNaN(x.y)&&!Number.isNaN(x.p)).sort((a,b)=>b.p-a.p);
  if(!pts.length) return null;
  let P=pts.filter(x=>x.y===1).length, N=pts.length-P;
  if(P===0||N===0) return null;
  let tp=0, fp=0, curve:[number,number][]= [];
  let last=-1;
  for(const x of pts){
    if(x.p!==last){
      curve.push([fp/N, tp/P]);
      last=x.p;
    }
    if(x.y===1) tp++; else fp++;
  }
  curve.push([fp/N,tp/P]);
  return curve;
}

function hist(values:number[], bins=10){
  if(!values.length) return {edges:[], counts:[]};
  const min=Math.min(...values), max=Math.max(...values);
  const step=(max-min||1)/bins;
  const counts=Array(bins).fill(0);
  values.forEach(v=>{
    let idx=Math.floor((v-min)/step); if(idx>=bins) idx=bins-1; if(idx<0) idx=0; counts[idx]++; });
  const edges=[...Array(bins+1)].map((_,i)=>min+i*step);
  return {edges, counts};
}

function numberish(x:any){ const n=Number(x); return Number.isFinite(n)?n:undefined; }

function topDrivers(rows:any[], against:'__pred'|string){
  if(!(rows?.length>0)) return [];
  const cols=Object.keys(rows[0]).filter(k=>k!==against && typeof rows[0][k]!=='object');
  const y = rows.map(r=> numberish(r[against]) ).filter(v=>v!==undefined) as number[];
  if(!y.length) return [];
  const meanY = y.reduce((a,b)=>a+b,0)/y.length;
  const drivers:{name:string,score:number}[]=[];
  for(const c of cols){
    const xs = rows.map(r=> numberish(r[c]) ).filter(v=>v!==undefined) as number[];
    if(xs.length!==y.length) continue;
    const meanX = xs.reduce((a,b)=>a+b,0)/xs.length;
    let num=0, dx=0, dy=0;
    for(let i=0;i<xs.length;i++){ const xv=xs[i]-meanX, yv=y[i]-meanY; num+=xv*yv; dx+=xv*xv; dy+=yv*yv; }
    const corr = (dx&&dy)? Math.abs(num/Math.sqrt(dx*dy)) : 0;
    if(Number.isFinite(corr)) drivers.push({name:c, score:corr});
  }
  return drivers.sort((a,b)=>b.score-a.score).slice(0,6);
}

function Box({title, children}:{title:string; children:any}){ return (
  <div className="card"><h2>{title}</h2><div className="body">{children}</div></div>
);}

export default function RightMetrics({rows, trainMetrics}:{rows:any[]; trainMetrics?:any}){
  const truthK = pickTruthKey(rows);
  const {probKey, predKey} = getPred(rows);
  const cm = computeCM(rows, truthK, predKey, probKey, 0.5);
  const roc = computeROC(rows, truthK, probKey);
  const probs = (rows||[]).map(r=> numberish(probKey? r[probKey] : undefined) ).filter(v=>v!==undefined) as number[];
  const H = hist(probs);
  const drivers = topDrivers(rows, predKey||'__pred');

  return (
    <>
      <Box title="Confusion Matrix">
        {!cm? <div className="muted">No model run yet.</div> :
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            {['TN','FP','FN','TP'].map((label,i)=>{
              const v = [cm[0][0],cm[0][1],cm[1][0],cm[1][1]][i];
              return <div key={label} style={{background:'#eef2ff',borderRadius:8,padding:'18px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700}}>{label}</div>
                <div style={{fontSize:18}}>{v}</div>
              </div>;
            })}
          </div>}
      </Box>

      <Box title="ROC">
        {!roc? <div className="muted">No ROC yet.</div> :
          <svg viewBox="0 0 100 100" style={{width:'100%',height:180,background:'#fff'}}>
            <polyline points="0,100 100,0" stroke="#ccc" strokeDasharray="4 4" fill="none"/>
            <polyline points={roc.map(([f,t])=>`${f*100},${100-t*100}`).join(' ')} stroke="#3b82f6" fill="none" strokeWidth="2"/>
          </svg>}
      </Box>

      <Box title="Predicted probability distribution">
        {!probs.length? <div className="muted">No predictions yet.</div> :
          <div style={{display:'grid',gridTemplateColumns:`repeat(${H.counts.length},1fr)`,alignItems:'end',gap:2,height:140}}>
            {H.counts.map((c,i)=><div key={i} title={`${c}`} style={{height:`${(c/Math.max(...H.counts))*100||0}%`,background:'#93c5fd',borderRadius:'4px 4px 0 0'}}/>)}
          </div>}
        <div className="muted" style={{marginTop:6}}>Histogram of predicted positive probability.</div>
      </Box>

      <Box title="Top drivers">
        {!drivers.length? <div className="muted">Not available yet.</div> :
          <div style={{display:'grid',gap:6}}>
            {drivers.map(d=>
              <div key={d.name} style={{display:'grid',gridTemplateColumns:'1fr 60px',gap:8,alignItems:'center'}}>
                <div style={{position:'relative',background:'#e5e7eb',height:10,borderRadius:6}}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.round(d.score*100)}%`,background:'#60a5fa',borderRadius:6}}/>
                  <div style={{position:'absolute',top:-18,left:0,fontSize:12}}>{d.name}</div>
                </div>
                <div className="muted" style={{textAlign:'right'}}>{(d.score*100).toFixed(0)}%</div>
              </div>
            )}
          </div>}
      </Box>

      <Box title="Training metrics">
        {!trainMetrics? <div className="muted">Not available yet.</div> :
          <ul className="muted" style={{margin:0}}>
            {Object.entries(trainMetrics).map(([k,v])=><li key={k}><b>{k}</b>: {String(v)}</li>)}
          </ul>}
      </Box>
    </>
  );
}
