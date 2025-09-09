export const runtime = 'nodejs';

import * as fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');

function toNum(v:any){
  if (typeof v==='number') return Number.isFinite(v)? v : NaN;
  const n = parseFloat(String(v).replace(/,/g,''));
  return Number.isFinite(n)? n : NaN;
}

export async function POST(req: Request){
  const { datasetId, target='Survived', by='Season' } = await req.json() as any;
  if (!datasetId) return new Response(JSON.stringify({ error:'datasetId required' }), { status:400, headers:{'content-type':'application/json'}});
  const raw = await fs.readFile(path.join(DATA_DIR, `${datasetId}.json`), 'utf8').catch(()=>null);
  if (!raw) return new Response(JSON.stringify({ error:'dataset not found' }), { status:404, headers:{'content-type':'application/json'}});
  const ds = JSON.parse(raw);
  const rows:any[] = ds.frame ?? ds.preview ?? [];
  const cols:string[] = ds.columns || (rows[0] ? Object.keys(rows[0]) : []);
  if (!cols.includes(target)) return new Response(JSON.stringify({ error:`target ${target} not found` }), { status:400, headers:{'content-type':'application/json'}});
  if (!cols.includes(by))     return new Response(JSON.stringify({ error:`column ${by} not found. Add it via Feature Engineering (e.g., Season from a date column).` }), { status:200, headers:{'content-type':'application/json'}});
  const g = new Map<string, {n:number; sum:number}>();
  for (const r of rows){
    const k = String(r[by] ?? '');
    const y = toNum(r[target]);
    if (!Number.isFinite(y)) continue;
    const cur = g.get(k) || { n:0, sum:0 };
    cur.n += 1; cur.sum += y;
    g.set(k, cur);
  }
  const table = Array.from(g.entries()).map(([k,v])=>({ group:k, n:v.n, rate: v.n? v.sum/v.n : 0 }));
  return new Response(JSON.stringify({ target, by, table }), { status:200, headers:{'content-type':'application/json','cache-control':'no-store'}});
}
