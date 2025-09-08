export const runtime = 'nodejs';
import * as fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');
const toNum = (v:any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/,/g,''));
  return Number.isFinite(n) ? n : NaN;
};

function guessDateColumn(cols:string[], rows:any[]){
  let best = { col:null as string|null, score:0 };
  for (const c of cols){
    let ok=0, tot=0;
    for (let i=0;i<rows.length && i<200;i++){
      const v = rows[i][c];
      if (v==null) continue;
      const d = new Date(v);
      if (!isNaN(d.getTime())) ok++;
      tot++;
    }
    const score = tot ? ok/tot : 0;
    if (score > best.score && score >= 0.5) best = { col:c, score };
  }
  return best.col;
}

function acf(series:number[], maxLag=24){
  const x = series.filter(Number.isFinite);
  const n = x.length;
  if (n<3) return [];
  const mean = x.reduce((s,v)=>s+v,0)/n;
  const denom = x.reduce((s,v)=> s + (v-mean)*(v-mean), 0) || 1;
  const out = [];
  for (let k=1;k<=maxLag;k++){
    let num=0;
    for (let t=k;t<n;t++) num += (x[t]-mean)*(x[t-k]-mean);
    out.push({ lag:k, acf: num/denom });
  }
  return out;
}

function movingAvg(series:number[], w=3){
  if (w<1) return series.slice();
  const n = series.length, out = Array(n).fill(null as number|null);
  const half = Math.floor(w/2);
  for (let i=0;i<n;i++){
    let s=0,c=0;
    for (let j=i-half;j<=i+half;j++){
      if (j>=0 && j<n && Number.isFinite(series[j])){ s+=series[j]; c++; }
    }
    out[i] = c? s/c : null;
  }
  return out;
}

export async function POST(req: Request) {
  const { datasetId, metrics } = await req.json() as { datasetId:string; metrics?: string[] };
  if (!datasetId) return new Response(JSON.stringify({ error:'datasetId required' }), { status:400, headers:{'content-type':'application/json'}});
  const raw = await fs.readFile(path.join(DATA_DIR, `${datasetId}.json`), 'utf8').catch(()=>null);
  if (!raw) return new Response(JSON.stringify({ error:'dataset not found' }), { status:404, headers:{'content-type':'application/json'}});
  const ds = JSON.parse(raw);
  const rows:any[] = ds.frame ?? ds.preview ?? [];
  const cols:string[] = ds.columns || (rows[0] ? Object.keys(rows[0]) : []);
  const dateCol = ds.fields?.date || guessDateColumn(cols, rows);
  if (!dateCol) return new Response(JSON.stringify({ error:'no date column detected' }), { status:400, headers:{'content-type':'application/json'} });

  // pick metrics: prefer Sales/Revenue/Profit/COGS if present
  const cand = ['Sales','Revenue','Profit','COGS','sales','revenue','profit','cogs'];
  const present = cand.filter(c => cols.includes(c));
  const numericCols = cols.filter(c => rows.some(r => Number.isFinite(toNum(r[c]))));
  const chosen = (metrics && metrics.length ? metrics : (present.length? present : numericCols.slice(0,4)));

  // build time-sorted series
  const series = rows
    .map(r=>({ d:new Date(r[dateCol]), ...chosen.reduce((o,c)=> (o[c]=toNum(r[c]),o),{} as any) }))
    .filter(r=> Number.isFinite(r.d.getTime()))
    .sort((a,b)=> a.d.getTime()-b.d.getTime());

  // monthly pattern and trend + acf
  const byMonth = new Map<number, any[]>();
  for (const r of series){
    const m = r.d.getMonth()+1;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(r);
  }

  const monthly:any = {};
  const trend:any = {};
  const acfs:any = {};
  const signals:any = {};

  for (const m of chosen){
    // monthly means 1..12
    const mo = [];
    for (let mm=1;mm<=12;mm++){
      const arr = (byMonth.get(mm) || []).map(r=> r[m]).filter(Number.isFinite);
      const val = arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
      mo.push({ month: mm, mean: val });
    }
    monthly[m] = mo;

    // trend by moving average
    const y = series.map(r=> r[m]);
    const tr = movingAvg(y, 3);
    trend[m] = series.map((r,i)=>({ t: r.d.toISOString().slice(0,10), value: y[i], trend: tr[i] }));

    // acf
    acfs[m] = acf(y, 24);

    // quick strengths
    const vals = y.filter(Number.isFinite);
    const varAll = (()=>{ const mu=vals.reduce((s,v)=>s+v,0)/(vals.length||1); return vals.reduce((s,v)=>s+(v-mu)*(v-mu),0)/(vals.length||1); })();
    const seasVar = mo.map(x=>x.mean).filter(Number.isFinite);
    const sVar = seasVar.length? (()=>{
      const mu = seasVar.reduce((s,v)=>s+v,0)/seasVar.length;
      return seasVar.reduce((s,v)=>s+(v-mu)*(v-mu),0)/(seasVar.length||1);
    })():0;
    const seasonalityStrength = varAll>0 ? Math.min(1, Math.max(0, sVar/varAll)) : 0;

    // trend strength via simple slope on index
    const idx = vals.map((_,i)=>i);
    const xbar = (idx.reduce((s,v)=>s+v,0)/(idx.length||1));
    const ybar = (vals.reduce((s,v)=>s+v,0)/(vals.length||1));
    let num=0, den=0;
    for (let i=0;i<idx.length;i++){ num += (idx[i]-xbar)*(vals[i]-ybar); den += (idx[i]-xbar)*(idx[i]-xbar); }
    const slope = den>0 ? (num/den) : 0;
    const trendStrength = Math.min(1, Math.max(0, Math.abs(slope) / (Math.sqrt(varAll)+1e-9)));

    const warnings:string[] = [];
    if (seasonalityStrength > 0.25) warnings.push('Marked seasonality detected');
    if (trendStrength > 0.25) warnings.push('Clear upward/downward trend');
    acfs[m].some((p:any)=>Math.abs(p.acf) > 0.4) && warnings.push('Autocorrelation present (consider seasonal model)');

    signals[m] = { seasonalityStrength, trendStrength, warnings };
  }

  return new Response(JSON.stringify({
    dateCol, metrics: chosen, monthly, trend, acf: acfs, signals
  }), { status:200, headers:{'content-type':'application/json','cache-control':'no-store'}});
}
