export const runtime = 'nodejs';

import * as fs from 'fs/promises';
import path from 'path';
import { Parser } from 'expr-eval';

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');

type Transform = { name: string; expr: string };
type Body = { datasetId: string; transforms: Transform[] };

const toNum = (v:any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/,/g,''));
  return Number.isFinite(n) ? n : NaN;
};

export async function POST(req: Request) {
  const { datasetId, transforms } = await req.json() as Body;
  if (!datasetId || !Array.isArray(transforms) || transforms.length===0) {
    return new Response(JSON.stringify({ error: 'datasetId and transforms[] required' }), { status: 400, headers: {'content-type':'application/json'}});
  }

  const p = path.join(DATA_DIR, `${datasetId}.json`);
  const raw = await fs.readFile(p, 'utf8').catch(()=>null);
  if (!raw) return new Response(JSON.stringify({ error:'dataset not found' }), { status:404, headers:{'content-type':'application/json'}});
  const ds = JSON.parse(raw);
  const rows:any[] = ds.frame ?? ds.preview ?? [];
  const cols: string[] = ds.columns || (rows[0] ? Object.keys(rows[0]) : []);

  // compile formulas
  const parser = new Parser({ allowMemberAccess:false });
  const compiled = transforms.map(t => ({ name: t.name.trim(), expr: t.expr, fn: parser.parse(t.expr) }));

  // apply to each row
  for (const r of rows) {
    // context = row with numeric coercion too
    const ctx: Record<string, any> = {};
    for (const k of Object.keys(r)) ctx[k] = (r[k] ?? null);
    // add also numeric_ aliases for convenience
    for (const k of Object.keys(r)) ctx[`num_${k}`] = toNum(r[k]);

    for (const t of compiled) {
      try {
        const val = t.fn.evaluate(ctx);
        r[t.name] = val;
      } catch {
        r[t.name] = null;
      }
    }
  }

  // update columns
  const added = compiled.map(c => c.name);
  const newCols = Array.from(new Set(cols.concat(added)));
  ds.columns = newCols;
  if (ds.frame) ds.frame = rows; else ds.preview = rows;
  ds.fields = ds.fields || {};
  ds.fields.derived = Array.from(new Set([...(ds.fields.derived||[]), ...added]));

  await fs.writeFile(p, JSON.stringify(ds), 'utf8');

  return new Response(JSON.stringify({
    ok:true,
    added,
    columns: newCols,
    preview: rows.slice(0,20)
  }), { status:200, headers:{'content-type':'application/json','cache-control':'no-store'}});
}
