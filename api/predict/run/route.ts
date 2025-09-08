import { NextResponse } from "next/server";

/* ---------- minimal dataset loader (works with your utils or JSON file) ---------- */
async function getDatasetById(id: string) {
  try {
    // Prefer your utils if present
    const mod = await import("@/utils/datasets").catch(() => null as any);
    if (mod?.getDataset) return await mod.getDataset(id);
    if (mod?.loadDataset) return await mod.loadDataset(id);
  } catch {}
  // Fallback to JSON written by upload route
  const { readFileSync, existsSync } = await import("fs");
  const p = `${process.cwd()}/data/datasets/${id}.json`;
  if (!existsSync(p)) throw new Error(`Dataset "${id}" not found at ${p}`);
  return JSON.parse(readFileSync(p, "utf-8"));
}

/* ---------- helpers ---------- */
type Row = Record<string, any>;

function isFiniteNum(x: any) { return typeof x === "number" && Number.isFinite(x); }
function asNum(x: any) { const n = Number(x); return Number.isFinite(n) ? n : null; }

function inferIntent(q: string): "forecast" | "impact" | "compare" {
  const s = q.toLowerCase();
  if (/(forecast|predict|next|future|trend)/.test(s)) return "forecast";
  if (/(compare|vs|versus|than)/.test(s)) return "compare";
  return "impact";
}

function detectDateCol(rows: Row[]) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0] ?? {});
  // common date names first
  const preferred = ["date", "day", "ds", "month", "time", "timestamp"];
  for (const name of preferred) if (name in rows[0]) return name;

  // heuristic: ISO-like strings in many rows
  for (const c of cols) {
    let hits = 0;
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const v = rows[i]?.[c];
      if (typeof v === "string" && /\d{4}-\d{2}-\d{2}/.test(v)) hits++;
    }
    if (hits >= 10) return c;
  }
  return null;
}

function getNumericCols(rows: Row[]) {
  if (!rows.length) return [] as string[];
  const cols = Object.keys(rows[0]);
  const nums: string[] = [];
  for (const c of cols) {
    let ok = 0, seen = 0;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const v = rows[i][c];
      const n = asNum(v);
      if (n != null) ok++;
      seen++;
    }
    if (seen && ok / seen > 0.6) nums.push(c);
  }
  return nums;
}

function getCategoricalCols(rows: Row[]) {
  if (!rows.length) return [] as string[];
  const cols = Object.keys(rows[0]);
  const cats: string[] = [];
  for (const c of cols) {
    const values = new Set<any>();
    for (let i = 0; i < Math.min(rows.length, 1000); i++) values.add(rows[i][c]);
    if (values.size > 1 && values.size <= Math.max(25, rows.length * 0.2)) cats.push(c);
  }
  return cats;
}

function pickTarget(question: string, rows: Row[], fields?: any) {
  // 1) explicit from backend fields
  const cand = fields?.target || fields?.yRevenue || fields?.y || null;
  if (cand && cand in (rows[0] || {})) return cand;

  // 2) mention in question
  const cols = Object.keys(rows[0] || {});
  for (const c of cols) {
    if (question.toLowerCase().includes(c.toLowerCase())) return c;
  }
  // 3) common business names
  const common = ["Revenue","Sales","Survived","Amount","PassengerId","y","target"];
  for (const name of common) if (name in (rows[0] || {})) return name;

  // 4) fallback to first numeric
  const nums = getNumericCols(rows);
  return nums[0] || cols[0];
}

function movingAverage(arr: number[], window = 3) {
  if (!arr?.length) return [];
  const w = Math.max(3, Math.min(12, window));
  const out: Array<number | null> = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= w) sum -= arr[i - w];
    if (i >= w - 1) out[i] = sum / w;
  }
  return out;
}

function rmse(a: (number|null)[], f: (number|null)[]) {
  let s = 0, n = 0;
  for (let i = 0; i < Math.max(a.length, f.length); i++) {
    const av = a[i], fv = f[i];
    if (isFiniteNum(av) && isFiniteNum(fv)) { s += Math.pow((av as number) - (fv as number), 2); n++; }
  }
  return n ? Math.sqrt(s / n) : null;
}
function mae(a: (number|null)[], f: (number|null)[]) {
  let s = 0, n = 0;
  for (let i = 0; i < Math.max(a.length, f.length); i++) {
    const av = a[i], fv = f[i];
    if (isFiniteNum(av) && isFiniteNum(fv)) { s += Math.abs((av as number) - (fv as number)); n++; }
  }
  return n ? s / n : null;
}

function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  let sx=0, sy=0, sxx=0, syy=0, sxy=0, m=0;
  for (let i=0;i<n;i++){
    const a = x[i], b = y[i];
    if (!isFiniteNum(a) || !isFiniteNum(b)) continue;
    m++; sx+=a; sy+=b; sxx+=a*a; syy+=b*b; sxy+=a*b;
  }
  if (m<3) return 0;
  const cov = sxy/m - (sx/m)*(sy/m);
  const vx = sxx/m - (sx/m)**2;
  const vy = syy/m - (sy/m)**2;
  const denom = Math.sqrt(Math.max(vx,0)*Math.max(vy,0));
  return denom ? cov/denom : 0;
}

/* ---------- POST ---------- */
export async function POST(req: Request) {
  try {
    const { id, question } = await req.json();
    if (!id) throw new Error("Missing dataset id");
    const ds = await getDatasetById(String(id));

    // rows: prefer rows, else preview, else data
    const rows: Row[] =
      (Array.isArray(ds?.rows) && ds.rows) ||
      (Array.isArray(ds?.preview) && ds.preview) ||
      (Array.isArray(ds?.data) && ds.data) ||
      [];

    const fields = ds?.fields || {};
    const intent = inferIntent(String(question || ""));

    const target = pickTarget(String(question || ""), rows, fields);
    const dateCol = detectDateCol(rows);

    // build numeric vector for target (binary OK)
    const y = rows.map(r => asNum(r?.[target])).filter(v => v != null) as number[];
    const labels = rows.map((r, i) => (dateCol ? String(r[dateCol]) : String(i + 1)));

    let payload: any = { id, name: ds?.name || ds?.title || null, intent, target, fields };

    if (intent === "forecast") {
      // If binary, smooth it (proportion in window); else raw
      const base = y.length ? y : [];
      const win = Math.min(12, Math.max(3, Math.floor(base.length / 6) || 3));
      const fc = movingAverage(base, win);

      payload.modelName = `Moving average (window=${win})`;
      payload.series = { actual: base, forecast: fc, labels };
      payload.metrics = { rmse: rmse(base, fc), mae: mae(base, fc) };
    } else {
      // Impact / drivers
      const cats = getCategoricalCols(rows);
      const nums = getNumericCols(rows).filter(c => c !== target);

      // groupRates: choose a reasonable driver from NLQ or first categorical
      let driver =
        cats.find(c => String(question).toLowerCase().includes(c.toLowerCase())) ||
        (cats.length ? cats[0] : null);

      // If no categorical and we do have a numeric, bin the top numeric driver
      let groupRates: Array<{ group: string; rate: number; n: number }> = [];
      if (driver) {
        const by: Record<string, { s: number; n: number }> = {};
        for (const r of rows) {
          const g = String(r[driver]);
          const v = asNum(r[target]);
          if (v == null) continue;
          if (!by[g]) by[g] = { s: 0, n: 0 };
          by[g].n++; by[g].s += v;
        }
        groupRates = Object.entries(by).map(([g, v]) => ({
          group: g,
          rate: v.n ? v.s / v.n : 0,
          n: v.n
        }));
      } else if (nums.length) {
        // bin the first numeric driver
        const top = nums[0];
        const vec = rows.map(r => asNum(r[top])).filter(v => v != null) as number[];
        const pairs: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < Math.min(y.length, vec.length); i++) {
          if (isFiniteNum(vec[i]) && isFiniteNum(y[i])) pairs.push({ x: vec[i], y: y[i] });
        }
        pairs.sort((a,b)=>a.x-b.x);
        const bins = 6;
        const bin: Record<number,{n:number,s:number}> = {};
        for (let i=0;i<pairs.length;i++){
          const k = Math.min(bins-1, Math.floor((i / pairs.length) * bins));
          if (!bin[k]) bin[k] = { n:0, s:0 };
          bin[k].n++; bin[k].s += pairs[i].y;
        }
        groupRates = Object.entries(bin).map(([k,v])=>({
          group: `bin-${Number(k)+1}`,
          rate: v.n ? v.s/v.n : 0,
          n: v.n
        }));
        payload.effectCurveName = top;
        payload.effectCurve = Object.entries(bin).map(([k,v]) => ({ x: Number(k)+1, y: v.n ? v.s/v.n : 0 }));
      }

      // importances: simple Pearson with sign
      const imp = nums.slice(0, 30).map(col => {
        const xv = rows.map(r => asNum(r[col])).filter(v => v != null) as number[];
        const n = Math.min(xv.length, y.length);
        const xs = xv.slice(0, n), ys = y.slice(0, n);
        const r = pearson(xs, ys);
        return { feature: col, score: Math.abs(r), sign: Math.sign(r) };
      }).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));

      payload.groupRates = groupRates;
      payload.importances = imp;
    }

    return NextResponse.json(payload);
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Prediction failed", { status: 400 });
  }
}
