export const runtime = 'nodejs';
import * as fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');
const toNum = (v:any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/,/g,''));
  return Number.isFinite(n) ? n : NaN;
};
function mean(a:number[]){const f=a.filter(Number.isFinite);return f.length?f.reduce((s,v)=>s+v,0)/f.length:NaN}
function median(a:number[]){const f=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!f.length)return NaN;const m=Math.floor(f.length/2);return f.length%2?f[m]:(f[m-1]+f[m])/2}
function sd(a:number[]){const f=a.filter(Number.isFinite);const mu=mean(f);return Math.sqrt(f.reduce((s,v)=>s+(v-mu)*(v-mu),0)/(f.length||1))}

type Task =
  | { type: 'impute', method:'mean'|'median'|'mode', columns: string[] }
  | { type: 'log1p', columns: string[] }
  | { type: 'standardize', columns: string[] }
  | { type: 'clip', z?: number, columns: string[] }
  | { type: 'dedupe' };

type Body = { datasetId: string; tasks: Task[] };

export async function POST(req: Request) {
  const { datasetId, tasks } = await req.json() as Body;
  if (!datasetId || !Array.isArray(tasks) || tasks.length===0) {
    return new Response(JSON.stringify({ error:'datasetId and tasks[] required' }), { status:400, headers:{'content-type':'application/json'}});
  }
  const p = path.join(DATA_DIR, `${datasetId}.json`);
  const raw = await fs.readFile(p, 'utf8').catch(()=>null);
  if (!raw) return new Response(JSON.stringify({ error:'dataset not found' }), { status:404, headers:{'content-type':'application/json'}});
  const ds = JSON.parse(raw);
  const rows:any[] = ds.frame ?? ds.preview ?? [];
  const cols: string[] = ds.columns || (rows[0] ? Object.keys(rows[0]) : []);

  for (const t of tasks) {
    if (t.type === 'impute') {
      for (const c of t.columns) {
        const vals = rows.map(r=>r[c]);
        if (t.method === 'mode') {
          const count = new Map<any,number>();
          for (const v of vals) count.set(v, (count.get(v)||0)+1);
          let best:any=null, b=0; for (const [k,v] of count) if (v>b && k!=null && k!==''){ best=k; b=v; }
          for (const r of rows) if (r[c]==null || r[c]==='') r[c] = best;
        } else {
          const nums = vals.map(toNum);
          const fill = t.method === 'median' ? median(nums) : mean(nums);
          for (const r of rows) if (r[c]==null || r[c]==='') r[c] = fill;
        }
      }
    }
    if (t.type === 'log1p') {
      for (const c of t.columns) for (const r of rows) {
        const v = toNum(r[c]); r[c] = Number.isFinite(v) && v>=-1 ? Math.log1p(v) : r[c];
      }
    }
    if (t.type === 'standardize') {
      for (const c of t.columns) {
        const nums = rows.map(r=>toNum(r[c]));
        const mu = mean(nums), s = sd(nums) || 1;
        for (const r of rows) { const v = toNum(r[c]); r[c] = Number.isFinite(v) ? (v - mu) / s : r[c]; }
      }
    }
    if (t.type === 'clip') {
      const z = t.z ?? 3;
      for (const c of t.columns) {
        const nums = rows.map(r=>toNum(r[c]));
        const mu = mean(nums), s = sd(nums) || 1;
        const lo = mu - z*s, hi = mu + z*s;
        for (const r of rows) { const v = toNum(r[c]); if (Number.isFinite(v)) r[c] = Math.min(Math.max(v, lo), hi); }
      }
    }
    if (t.type === 'dedupe') {
      const seen = new Set<string>();
      for (let i=rows.length-1;i>=0;i--){
        const k = JSON.stringify(rows[i]);
        if (seen.has(k)) rows.splice(i,1); else seen.add(k);
      }
    }
  }

  ds.columns = Array.from(new Set(cols));
  if (ds.frame) ds.frame = rows; else ds.preview = rows;
  await fs.writeFile(p, JSON.stringify(ds), 'utf8');

  return new Response(JSON.stringify({ ok:true, rows: rows.length }), { status:200, headers:{'content-type':'application/json','cache-control':'no-store'}});
}
