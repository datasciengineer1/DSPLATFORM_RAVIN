export const runtime = 'nodejs';

type Body = { column: string; method?: 'iqr'|'zscore'; z?: number; iqrK?: number; rows: any[]; };

function toNum(v:any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[\$,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const body = await req.json() as Body;
  const col = body.column;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!col || !rows.length) return Response.json({ ok:false, error:"column and rows are required" }, { status:400 });

  const vals = rows.map(r => toNum(r[col])).filter((v): v is number => v != null).sort((a,b)=>a-b);
  if (!vals.length) return Response.json({ ok:false, error:"no numeric values" }, { status:400 });

  const method = body.method || 'iqr';

  let lower=-Infinity, upper=Infinity;
  if (method === 'zscore') {
    const n = vals.length;
    const mean = vals.reduce((s,v)=>s+v,0)/n;
    const sd = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/n) || 1;
    const z = body.z ?? 3;
    lower = mean - z*sd; upper = mean + z*sd;
  } else {
    const q1 = vals[Math.floor(0.25*(vals.length-1))];
    const q3 = vals[Math.floor(0.75*(vals.length-1))];
    const iqr = (q3 - q1) || 1;
    const k = body.iqrK ?? 1.5;
    lower = q1 - k*iqr; upper = q3 + k*iqr;
  }

  const indices = rows.map((r,i)=>({i, v:toNum(r[col])})).filter(o=> o.v!=null && (o.v < lower || o.v > upper));
  return Response.json({ ok:true, method, lower, upper, outliers: indices.map(o=>o.i) });
}
