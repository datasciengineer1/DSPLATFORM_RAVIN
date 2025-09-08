export const runtime = 'nodejs';
import * as fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');
const toNum = (v:any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/,/g,''));
  return Number.isFinite(n) ? n : NaN;
};

function stats(arr:number[]){
  const a = arr.filter(Number.isFinite);
  const n = a.length;
  if (!n) return { n:0, mean:NaN, sd:NaN, skew:NaN };
  const mu = a.reduce((s,v)=>s+v,0)/n;
  const sd = Math.sqrt(a.reduce((s,v)=>s+(v-mu)*(v-mu),0)/(n||1));
  const skew = (n>2 && sd>0) ? (a.reduce((s,v)=>s+Math.pow((v-mu)/sd,3),0)/n) : 0;
  return { n, mean:mu, sd, skew };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const datasetId = url.searchParams.get('datasetId');
  if (!datasetId) return new Response(JSON.stringify({ error:'datasetId required' }), { status:400, headers:{'content-type':'application/json'}});
  const raw = await fs.readFile(path.join(DATA_DIR, `${datasetId}.json`), 'utf8').catch(()=>null);
  if (!raw) return new Response(JSON.stringify({ error:'dataset not found' }), { status:404, headers:{'content-type':'application/json'}});
  const ds = JSON.parse(raw);
  const rows:any[] = ds.frame ?? ds.preview ?? [];
  const cols: string[] = ds.columns || (rows[0] ? Object.keys(rows[0]) : []);

  const recs:any[] = [];
  // missingness
  for (const c of cols) {
    const total = rows.length || 1;
    const miss = rows.reduce((s,r)=> s + ((r[c]===null || r[c]===undefined || r[c]==='') ? 1:0), 0);
    const rate = miss/total;
    if (rate>0) {
      const numeric = rows.some(r=> Number.isFinite(toNum(r[c])));
      recs.push({ type:'impute', column:c, numeric, rate, suggestion: numeric ? 'median' : 'mode' });
    }
  }
  // zero-variance / near-constant
  for (const c of cols) {
    const vals = Array.from(new Set(rows.map(r=>r[c]).filter(v=>v!==null && v!==undefined && v!=='')));
    if (vals.length<=1) recs.push({ type:'constant', column:c, suggestion:'drop or re-check source' });
  }
  // numeric skew / outliers
  for (const c of cols) {
    const nums = rows.map(r=>toNum(r[c])).filter(Number.isFinite);
    if (nums.length>=20) {
      const { sd, skew } = stats(nums);
      if (Math.abs(skew) > 1) recs.push({ type:'skew', column:c, skew, suggestion:'log1p transform' });
      // outliers by z-score
      if (sd>0) {
        const out = nums.filter(v => Math.abs((v - (nums.reduce((s,v)=>s+v,0)/nums.length))/sd) > 3).length;
        if (out > 0) recs.push({ type:'outliers', column:c, count: out, suggestion:'clip/winsorize (z=3)' });
      }
    }
  }
  // high-cardinality categoricals
  for (const c of cols) {
    const uniq = new Set(rows.map(r=> String(r[c] ?? '')));
    if (uniq.size > 100) {
      recs.push({ type:'cardinality', column:c, unique: uniq.size, suggestion:'target/impact encoding or hash buckets' });
    }
  }
  // duplicates
  const dup = new Set<string>();
  let dups = 0;
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (dup.has(k)) dups++; else dup.add(k);
  }
  if (dups>0) recs.push({ type:'duplicates', rows: dups, suggestion:'drop duplicates' });

  // scaling
  recs.push({ type:'scaling', columns:'numeric', suggestion:'standardize (z-score) before linear models' });

  return new Response(JSON.stringify({ recommendations: recs }), { status:200, headers:{'content-type':'application/json','cache-control':'no-store'}});
}
