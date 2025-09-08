// utils/eda.ts
export function toNumber(v: any): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v).trim();
  let pct = false;
  if (s.endsWith("%")) { pct = true; s = s.slice(0,-1); }
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1,-1);
  s = s.replace(/[\$,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (pct ? n/100 : n) : undefined;
}

eexport function computeBinsStrict(values: number[], k: number) {
  if (!values.length || !Number.isFinite(k) || k <= 0) return [];
  const xs = [...values].sort((a,b)=>a-b);
  const min = xs[0], max = xs[xs.length-1];
  if (min === max) return [{ x0:min, x1:max, count:xs.length }];
  const bins = Math.max(1, Math.min(200, Math.floor(k)));
  const width = (max - min) / bins;
  const out = Array.from({length:bins}, (_,i)=>({
    x0: min + i*width,
    x1: i===bins-1 ? max : min + (i+1)*width,
    count: 0
  }));
  for (const v of xs) {
    if (!Number.isFinite(v)) continue;
    let idx = Math.floor((v - min) / (width || 1));
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    out[idx].count++;
  }
  return out;
}


// Quick numeric check on a sample
export function isMostlyNumeric(arr: any[], sample = 128): boolean {
  let seen = 0, good = 0;
  for (const v of arr) {
    if (v == null || v === "") continue;
    seen++;
    if (toNumber(v) !== undefined) good++;
    if (seen >= sample) break;
  }
  return seen > 0 && good / seen >= 0.8;
}

// Freedman–Diaconis-ish binning with a safe fallback
export function computeBins(values: number[], desired = 20) {
  if (!values.length) return [];
  const xs = [...values].sort((a, b) => a - b);
  const min = xs[0], max = xs[xs.length - 1];
  if (min === max) return [{ x0: min, x1: max, count: xs.length }];

  const q = (p: number) => xs[Math.floor(p * (xs.length - 1))];
  const iqr = Math.max(1e-9, q(0.75) - q(0.25));
  const fdWidth = (2 * iqr) / Math.cbrt(xs.length);
  const width = Math.max(fdWidth, (max - min) / Math.max(5, desired));
  const k = Math.min(100, Math.max(5, Math.ceil((max - min) / width)));

  const binWidth = (max - min) / k;
  const bins = Array.from({ length: k }, (_, i) => ({
    x0: min + i * binWidth,
    x1: i === k - 1 ? max : min + (i + 1) * binWidth,
    count: 0,
  }));

  let bi = 0;
  for (const v of xs) {
    while (bi < k - 1 && v >= bins[bi].x1) bi++;
    bins[bi].count++;
  }
  return bins;
}
