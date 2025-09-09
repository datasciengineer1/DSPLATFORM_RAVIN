import { NextResponse } from "next/server";
import { loadDatasetSync } from "@/utils/datasets";

type Body = {
  datasetId: string;
  impute?: { strategy: "mean" | "median" | "mode" };
  onehot?: string[]; // categorical columns
  limit?: number;
};

function isNum(x: any) { return typeof x === "number" && Number.isFinite(x); }

function imputeCol(values: any[], how: "mean"|"median"|"mode") {
  const clean = values.filter(isNum) as number[];
  if (!clean.length) return values.map(v => (v == null ? 0 : v));
  if (how === "mean") {
    const m = clean.reduce((a,c)=>a+c,0)/clean.length;
    return values.map(v => (v == null ? m : v));
  }
  if (how === "median") {
    const s = [...clean].sort((a,b)=>a-b);
    const m = s[Math.floor(s.length/2)];
    return values.map(v => (v == null ? m : v));
  }
  // mode
  const freq = new Map<number, number>();
  for (const n of clean) freq.set(n, (freq.get(n)||0)+1);
  const mode = [...freq.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  return values.map(v => (v == null ? mode : v));
}

export async function POST(req: Request) {
  const body = await req.json() as Body;
  const { datasetId, impute, onehot = [], limit = 100 } = body || {};
  if (!datasetId) return NextResponse.json({ error: "datasetId required" }, { status: 400 });

  const ds = loadDatasetSync(datasetId);
  const rows: any[] = ds.rows || ds.data || [];
  if (!rows.length) return NextResponse.json({ rows: [], columns: [] });

  // impute numeric
  let out = [...rows];
  if (impute) {
    const keys = Object.keys(out[0] || {});
    for (const k of keys) {
      const col = out.map(r => r?.[k]);
      if (col.some(isNum)) {
        const filled = imputeCol(col, impute.strategy);
        out = out.map((r, i) => ({ ...r, [k]: filled[i] }));
      }
    }
  }

  // one-hot
  if (onehot.length) {
    out = out.map(r => {
      let rr = { ...r };
      for (const col of onehot) {
        const val = r?.[col];
        if (val != null) {
          rr[`${col}__${String(val)}`] = 1;
        }
        delete (rr as any)[col];
      }
      return rr;
    });
  }

  const preview = out.slice(0, limit);
  return NextResponse.json({ columns: Object.keys(preview[0] || {}), preview });
}
