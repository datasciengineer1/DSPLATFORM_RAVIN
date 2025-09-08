// utils/nlq.ts
export type DetectedTask = "forecast" | "drivers" | "regress" | "classify" | "viz";

export function detectTask(q: string): DetectedTask {
  const s = q.toLowerCase();

  const mentionsImpact =
    /\b(impact|effect|influenc|relationship|correlat|vs|versus|against|drive[sd]?)\b/.test(s);

  const isBreakdown =
    /\b(which|top|most|best|largest|highest|biggest|contributed|share|breakdown|composition)\b/.test(s) &&
    /\b(channel|region|country|state|city|segment|category|dept|department|sku|product|brand|source|campaign|market)\b/.test(s);

  const wantsForecast =
    /\b(forecast|predict|projection|project(ed)?|estimate|outlook)\b/.test(s) ||
    /\bnext\s+(month|quarter|year|week)\b/.test(s) ||
    /\bcoming\s+(month|quarter|year|week)\b/.test(s);

  if (isBreakdown) return "viz";
  if (mentionsImpact && !/\b(forecast|predict|projection|project)\b/.test(s)) return "viz";
  if (wantsForecast) return "forecast";
  if (/\b(classif|churn|convert|probab|likelihood|will\s+.*\?)\b/.test(s)) return "classify";
  return "drivers";
}



export function preferTarget(question: string, fields: Record<string,string|string[]> = {}) {
  const q = (question||"").toLowerCase();
  const allCandidates = Object.values(fields).flat().map(String);
  const firstHit = allCandidates.find(f => q.includes(f.toLowerCase()));
  return firstHit || (fields.yRevenue as string) || (fields.target as string) || "Sales";
}

export function combineSeries(
  actual: Array<number | null | undefined>,
  forecast: Array<number | null | undefined>,
  labels?: string[]
) {
  const N = Math.max(actual?.length || 0, forecast?.length || 0, labels?.length || 0);
  const rows: any[] = [];

  function toNum(v: any): number | undefined {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  function toDateLike(s?: string) {
    if (!s) return undefined;
    const d = new Date(String(s));
    return Number.isFinite(+d) ? d : undefined;
  }

  for (let i = 0; i < N; i++) {
    const a = toNum(actual?.[i]);
    const f = toNum(forecast?.[i]);
    const lbl = labels?.[i];
    const d = toDateLike(lbl);

    rows.push({
      idx: i + 1,
      ...(d ? { date: d.toISOString().slice(0, 10) } : {}),
      actual: a ?? null,
      forecast: f ?? null,
    });
  }
  return rows;
}


export function rmse(a:(number|null)[], f:(number|null)[]) {
  let s=0,n=0; for (let i=0;i<a.length;i++){ const av=a[i],fv=f[i]; if(Number.isFinite(av as number)&&Number.isFinite(fv as number)){ s+=Math.pow((fv as number)-(av as number),2); n++; } }
  return n?Math.sqrt(s/n):null;
}
export function mae(a:(number|null)[], f:(number|null)[]) {
  let s=0,n=0; for (let i=0;i<a.length;i++){ const av=a[i],fv=f[i]; if(Number.isFinite(av as number)&&Number.isFinite(fv as number)){ s+=Math.abs((fv as number)-(av as number)); n++; } }
  return n? s/n:null;
}

export function buildExplainability(opts: {
  question: string; task: DetectedTask; target: string;
  rmse?: number|null; mae?: number|null; notes?: string[];
  seasonalityHint?: string; trendHint?: string;
}) {
  const bullets: string[] = [];
  bullets.push(`You asked about **${opts.target}** (${opts.task}).`);

  if (opts.task === "forecast") {
    if (opts.trendHint) bullets.push(`**Trend:** ${opts.trendHint}.`);
    if (opts.seasonalityHint) bullets.push(`**Seasonality:** ${opts.seasonalityHint}.`);
    if (opts.rmse!=null || opts.mae!=null)
      bullets.push(`**Model quality (last window):** RMSE ${fmt(opts.rmse)}, MAE ${fmt(opts.mae)}.`);
    bullets.push(`**Interpretation:** Orange = forecast (smoothed/MA); blue = actual. Focus on the right-hand gap for near-term error.`);
    bullets.push(`**Next steps:** Try a regression in **Model** (add drivers like price/promotions) to simulate counterfactuals; or add calendar features in **Engineering** to capture seasonality.`);
  } else if (opts.task === "drivers") {
    bullets.push(`We computed simple statistical associations to surface potential drivers (not causation).`);
    bullets.push(`Use **Model → regression** to quantify uplift with controls, or fit a multivariate setup and run counterfactuals (e.g., “what if price drops 10%?”).`);
  } else if (opts.task === "classify") {
    bullets.push(`We’ll treat this as a classification question (e.g., probability of event).`);
    bullets.push(`Consider **Model → AutoML** to train a classifier, then use SHAP/feature importance for per-driver explanations.`);
  } else {
    bullets.push(`We’ll treat this as a numeric prediction (regression). Try AutoML for a quick baseline, then iterate with feature engineering.`);
  }

  (opts.notes||[]).forEach(n=>bullets.push(n));
  return bullets;
}

function fmt(x:any){ return x==null ? "—" : Number(x).toLocaleString(); }
