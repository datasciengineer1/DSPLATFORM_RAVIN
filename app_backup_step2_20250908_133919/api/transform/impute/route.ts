export const runtime = 'nodejs';

type Body = { column: string; strategy?: 'mean'|'median'|'mode'|'zero'|'ffill'|'bfill'; rows: any[]; };

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
  const strategy = body.strategy || 'median';

  if (!col || !rows.length) return Response.json({ ok:false, error:"column and rows are required" }, { status:400 });

  const nums = rows.map(r=>toNum(r[col])).filter((v): v is number => v!=null).sort((a,b)=>a-b);
  const median = nums.length ? nums[Math.floor(nums.length/2)] : 0;
  const mean = nums.length ? nums.reduce((s,v)=>s+v,0)/nums.length : 0;

  const mode = (()=>{ const freq: Record<string, number> = {};
    for (const r of rows) { const x = r[col]; if (x == null || x === "") continue; const k = String(x); freq[k] = (freq[k] || 0) + 1; }
    let mKey: string | null = null, mVal = -1;
    for (const [k,v] of Object.entries(freq)) if (v > mVal) { mVal = v; mKey = k; }
    return mKey;
  })();

  const patched = rows.map((r, idx) => {
    if (r[col] != null && r[col] !== "") return r;
    const out = { ...r };
    switch (strategy) {
      case 'zero': out[col] = 0; break;
      case 'mean': out[col] = mean; break;
      case 'median': out[col] = median; break;
      case 'ffill': out[col] = idx>0 ? rows[idx-1][col] ?? median : median; break;
      case 'bfill': out[col] = idx<rows.length-1 ? rows[idx+1][col] ?? median : median; break;
      default: out[col] = mode ?? median;
    }
    return out;
  });

  return Response.json({ ok:true, strategy, stats: { mean, median, mode }, rows: patched });
}
