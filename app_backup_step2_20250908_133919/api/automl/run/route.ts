import { NextResponse } from "next/server";
import { loadDatasetSync } from "@/utils/datasets";

// helpers
function isNumeric(x: any) { return typeof x === "number" && Number.isFinite(x); }
function column(arr: any[], key: string) { return arr.map(r => r?.[key]); }
function unique(arr: any[]) { return Array.from(new Set(arr)); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { datasetId, target, mode = "auto", task } = body;

  if (!datasetId) return NextResponse.json({ error: "datasetId required" }, { status: 400 });
  const ds = loadDatasetSync(String(datasetId));
  const rows: any[] = ds.rows || ds.data || [];
  if (!rows.length) return NextResponse.json({ error: "dataset is empty" }, { status: 400 });

  // pick target if missing
  let tgt = target;
  if (!tgt) {
    const keys = Object.keys(rows[0] || {});
    // simple heuristic: prefer numeric columns named like revenue/value/amount/target
    tgt = keys.find(k => /revenue|amount|value|sales|target/i.test(k) && isNumeric(rows[0]?.[k])) 
       || keys.find(k => isNumeric(rows[0]?.[k]))
       || keys[0];
  }

  const y = column(rows, tgt);
  const numericY = y.filter(isNumeric);
  const isReg = task ? task === "regression" : numericY.length >= y.length * 0.6;

  // === REGRESSION (baseline: mean and 3-step moving average)
  if (isReg) {
    const series = numericY.map((v, i) => ({ idx: i + 1, actual: v }));
    // moving average window
    const w = Math.min(12, Math.max(3, Math.floor(series.length / 6) || 3));
    const forecast = series.map((_, i) => {
      let s = 0, c = 0;
      for (let j = i - w + 1; j <= i; j++) {
        if (j >= 0 && isNumeric(series[j]?.actual)) { s += series[j].actual; c++; }
      }
      return c ? s / c : null;
    });

    // metrics
    let sse = 0, mae = 0, n = 0;
    for (let i = 0; i < series.length; i++) {
      const a = series[i].actual, f = forecast[i];
      if (isNumeric(a) && isNumeric(f)) { sse += (a - f) ** 2; mae += Math.abs(a - f); n++; }
    }
    const rmse = n ? Math.sqrt(sse / n) : null;
    const m_mae = n ? mae / n : null;

    const points = series.map((d, i) => ({ idx: d.idx, actual: d.actual, forecast: forecast[i] }));

    return NextResponse.json({
      task: "regression",
      target: tgt,
      model: { name: `Moving average`, params: { window: w } },
      metrics: { rmse, mae: m_mae },
      charts: { series: points }, // chart-ready
    });
  }

  // === CLASSIFICATION (baseline: majority class + frequency as score)
  const classes = unique(y.filter(v => v != null));
  const counts = new Map<string, number>();
  for (const v of y) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pTop = (counts.get(top) || 0) / Math.max(1, y.length);

  // predictions: always predict top class, score = pTop
  const truth = y.map(v => String(v));
  const pred = y.map(() => top);

  // confusion matrix
  const matrix = classes.map(row =>
    classes.map(col => truth.reduce((acc, t, i) => acc + (t === row && pred[i] === col ? 1 : 0), 0))
  );

  // fake ROC by thresholding around pTop
  const roc = Array.from({ length: 11 }, (_, k) => {
    const thr = k / 10;
    // since we predict single class with fixed score, ROC will be a diagonal-ish line
    const tp = truth.reduce((a, t) => a + (t === top && pTop >= thr ? 1 : 0), 0);
    const fp = truth.reduce((a, t) => a + (t !== top && pTop >= thr ? 1 : 0), 0);
    const tn = truth.reduce((a, t) => a + (t !== top && pTop < thr ? 1 : 0), 0);
    const fn = truth.reduce((a, t) => a + (t === top && pTop < thr ? 1 : 0), 0);
    const tpr = tp + fn ? tp / (tp + fn) : 0;
    const fpr = fp + tn ? fp / (fp + tn) : 0;
    return { thr, tpr, fpr };
  });

  const accuracy = truth.reduce((a, t, i) => a + (t === pred[i] ? 1 : 0), 0) / Math.max(1, truth.length);

  return NextResponse.json({
    task: "classification",
    target: tgt,
    model: { name: "Majority class baseline" },
    metrics: { accuracy, aucApprox: roc.reduce((a, p) => a + p.tpr * (1 / 10), 0) }, // rough
    charts: { classes, confusion: matrix, roc },
  });
}
