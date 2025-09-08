// app/engineering/page.tsx
"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";

/** ---------------- Small local UI helpers ---------------- */
function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[var(--surface)] p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold leading-tight">{title}</h3>
          {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const cls = {1:"grid-cols-1",2:"grid-cols-1 md:grid-cols-2",3:"grid-cols-1 md:grid-cols-3",4:"grid-cols-1 md:grid-cols-4"}[cols];
  return <div className={`grid ${cls} gap-3`}>{children}</div>;
}
function Button({ children, variant="default", ...props }: any) {
  const base = "px-3 py-1.5 text-sm rounded-md ";
  const style = variant==="default" ? "bg-blue-600 text-white hover:bg-blue-700"
              : variant==="outline" ? "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              : "bg-zinc-900 text-white hover:bg-black";
  return <button className={base+style} {...props}>{children}</button>;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-700">{children}</span>;
}

/** ---------------- Types & demo context ---------------- */
type Group = "data" | "feature";
type TaskId =
  | "impute" | "skew" | "log1p" | "outliers" | "clip" | "dedupe" | "scaling"
  | "target" | "encoding" | "binning" | "interactions" | "dateparts" | "polynomial" | "formula";

type ColStat = {
  name: string;
  dtype: "numeric" | "categorical" | "datetime" | string;
  missing_pct?: number;
  skew?: number;
  std?: number;
  mean?: number;
  cv?: number;
  outlier_frac?: number;
  unique_count?: number;
  cardinality?: number;
  constant?: boolean;
};

const demoCols = {
  numeric: ["Revenue", "COGS", "GrossMargin", "Quantity"],
  categorical: ["Category", "City", "Region"],
  datetime: ["Date"],
};

const DATA_TASKS: { id: TaskId; label: string; note?: string }[] = [
  { id: "impute",    label: "Impute Missing",  note: "Mean/Median/Mode/Constant" },
  { id: "skew",      label: "Skew / Normality", note: "Detect & suggest fix" },
  { id: "log1p",     label: "Log1p Transform",  note: "Reduce long right tails" },
  { id: "outliers",  label: "Outliers",         note: "IQR or Z-score" },
  { id: "clip",      label: "Clip",             note: "Min/Max bounds" },
  { id: "dedupe",    label: "Dedupe",           note: "Drop duplicate rows" },
  { id: "scaling",   label: "Scaling",          note: "Standard / MinMax / Robust" },
];
const FE_TASKS: { id: TaskId; label: string; note?: string }[] = [
  { id: "formula",     label: "Formula Builder",      note: "Create features from expressions" },
  { id: "target",      label: "Target Column",        note: "Select label" },
  { id: "encoding",    label: "Encoding",             note: "One-hot / Target" },
  { id: "binning",     label: "Binning",              note: "Equal width / freq" },
  { id: "interactions",label: "Interactions",         note: "f1 × f2 crosses" },
  { id: "dateparts",   label: "Date Parts",           note: "Year/Month/DOW" },
  { id: "polynomial",  label: "Polynomial",           note: "Degree 2–3" },
];

/** ---------------- Recommendation Engine ---------------- */
type Suggestion = {
  id: TaskId;
  label: string;
  reason: string;
  confidence: number; // 0..1
  prefill?: Record<string, any>;
  group: Group;
};
function normalizePct(v?: number) { if (v == null) return 0; return v > 1 ? v : v * 100; }
function useStats(): { stats: ColStat[]; rows: number; dupes: number } {
  const summary: any = (globalThis as any).__eds_summary || {};
  const missing: any = (globalThis as any).__eds_missing || {};
  const dtypes: any[] = (globalThis as any).__eds_dtypes || [];
  const profile: ColStat[] = (globalThis as any).__profile_stats || [];
  const dupes = Number((globalThis as any).__dupes_count || 0);
  let stats = profile;
  if (!stats.length && (dtypes.length || (missing.by_column||[]).length)) {
    const missMap = new Map((missing.by_column||[]).map((r:any)=>[r.column, r]));
    stats = (dtypes||[]).map((d:any)=>({
      name: d.column,
      dtype: (d.dtype||"").toLowerCase().includes("int") || (d.dtype||"").toLowerCase().includes("float") ? "numeric"
           : (d.dtype||"").toLowerCase().includes("date") ? "datetime" : "categorical",
      unique_count: d.unique,
      missing_pct: missMap.get(d.column)?.pct
    }));
  }
  return { stats, rows: Number(summary?.rows || 0), dupes };
}
function buildSuggestions(stats: ColStat[], rows: number, dupes: number): Suggestion[] {
  const sugg: Suggestion[] = [];
  const num = stats.filter(s => s.dtype === "numeric");
  const cat = stats.filter(s => s.dtype !== "numeric" && s.dtype !== "datetime");
  const dt  = stats.filter(s => s.dtype === "datetime");

  const missNum = num.filter(s => normalizePct(s.missing_pct) >= 1);
  if (missNum.length) {
    const skewy = missNum.filter(s => Math.abs(Number(s.skew||0)) > 0.75).map(s => s.name);
    const nonSkew = missNum.filter(s => !(Math.abs(Number(s.skew||0)) > 0.75)).map(s => s.name);
    if (nonSkew.length) sugg.push({ id:"impute", group:"data", label:"Impute (Mean)",
      reason:`Missing values in ${nonSkew.slice(0,3).join(", ")}${nonSkew.length>3?` +${nonSkew.length-3}`:""}; mean is fine when skew is low.`,
      confidence:0.8, prefill:{ cols: nonSkew.join(", "), method: "Mean" } });
    if (skewy.length) sugg.push({ id:"impute", group:"data", label:"Impute (Median)",
      reason:`Skewed numeric columns with missing values (${skewy.slice(0,3).join(", ")}…); median is robust to skew.`,
      confidence:0.9, prefill:{ cols: skewy.join(", "), method: "Median" } });
  }

  const highCV = num.filter(s => Number(s.cv || (s.std && s.mean ? (Math.abs(s.mean)>1e-9 ? (s.std!/Math.abs(s.mean!)) : 0) : 0)) > 0.5);
  if (highCV.length) sugg.push({ id:"scaling", group:"data", label:"Scale (Standard)",
    reason:`Large variation (CV>0.5) in ${highCV.slice(0,3).map(s=>s.name).join(", ")}…; standardize before linear models.`,
    confidence:0.75, prefill:{ cols: highCV.map(s=>s.name).join(", "), method: "Standard (z-score)" } });

  const skewRight = num.filter(s => Number(s.skew || 0) > 1.0);
  if (skewRight.length) sugg.push({ id:"log1p", group:"data", label:"Log1p (reduce right-tail)",
    reason:`Strong right-skew in ${skewRight.slice(0,3).map(s=>s.name).join(", ")}…; log1p can stabilize variance.`,
    confidence:0.85, prefill:{ cols: skewRight.map(s=>s.name).join(", "), onlyIfSkewed: true } });

  const outly = num.filter(s => Number(s.outlier_frac || 0) > 0.03);
  if (outly.length) sugg.push({ id:"outliers", group:"data", label:"Cap outliers (IQR)",
    reason:`Outlier rate >3% in ${outly.slice(0,3).map(s=>s.name).join(", ")}…; cap to IQR bounds.`,
    confidence:0.8, prefill:{ cols: outly.map(s=>s.name).join(", "), method:"IQR (k=1.5)", treatment:"Cap to bounds" } });

  const clipNames = num.map(s=>s.name).filter(n => /rate|pct|percentage|ratio/i.test(n));
  if (clipNames.length) sugg.push({ id:"clip", group:"data", label:"Clip to [0,1] (ratios)",
    reason:`Fields that look like ratios/percentages (${clipNames.slice(0,3).join(", ")}…); clip to [0,1].`,
    confidence:0.6, prefill:{ cols: clipNames.join(", "), min: 0, max: 1 } });

  if (dupes > 0) sugg.push({ id:"dedupe", group:"data", label:"Drop duplicate rows",
    reason:`Detected ${dupes.toLocaleString()} potential duplicate rows.`, confidence:0.9, prefill:{} });

  const highCard = cat.filter(s => Number(s.unique_count || s.cardinality || 0) > 50);
  if (highCard.length) sugg.push({ id:"encoding", group:"feature", label:"Target Encoding (high cardinality)",
    reason:`Categoricals with many levels (${highCard.slice(0,3).map(s=>s.name).join(", ")}…); prefer target encoding.`,
    confidence:0.8, prefill:{ cols: highCard.map(s=>s.name).join(", "), method:"Target Encoding", smoothing:10 } });

  if (dt.length) sugg.push({ id:"dateparts", group:"feature", label:"Extract Date Parts",
    reason:`Datetime column(s) present (${dt.map(s=>s.name).join(", ")}); add Year/Month/DOW as signals.`,
    confidence:0.7, prefill:{ column: dt[0].name, parts:["year","month","dow"] } });

  return sugg;
}

/** ---------------- Fetch helpers to Preview/Apply ---------------- */
async function postJSON(url: string, body: any) {
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:r.ok, text }; }
}

/** ---------------- Main Workbench ---------------- */
type Prefill = Record<string, any> | null;

export default function EngineeringWorkbench() {
  const [group, setGroup] = useState<Group>("data");
  const [active, setActive] = useState<TaskId>("impute");
  const [prefill, setPrefill] = useState<Prefill>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const { stats, rows, dupes } = useStats();
  const suggestions = useMemo(() => buildSuggestions(stats, rows, dupes), [stats, rows, dupes]);

  const tasks = group === "data" ? DATA_TASKS : FE_TASKS;
  React.useEffect(() => { if (!tasks.find(t => t.id === active)) setActive(tasks[0].id); }, [group]); // eslint-disable-line

  function jumpTo(s: any) { setGroup(s.group); setActive(s.id); setPrefill(s.prefill || null); }

  async function handlePreview(task: TaskId, payload: any) {
    setBusy(true); setPreview(null);
    const res = await postJSON("/api/engineering/preview", { task, payload });
    setPreview(res); setBusy(false);
  }
  async function handleApply(task: TaskId, payload: any) {
    setBusy(true);
    const res = await postJSON("/api/engineering/apply", { task, payload });
    setBusy(false);
    alert(res?.message || "Applied.");
  }

  return (
    <main className="container mx-auto px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <Link href="/eda" className="px-3 py-1.5 rounded-lg border">← Back to EDA</Link>
          <Link href="/nlq" className="px-3 py-1.5 rounded-lg border">Continue to NLQ →</Link>
        </div>
        <div className="flex items-center gap-2">
          <Chip>Rows: {rows || 0}</Chip>
          <Chip>Cols: {stats.length || 0}</Chip>
          {dupes ? <Chip>Dupes: {dupes}</Chip> : null}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT RAIL */}
        <aside className="col-span-12 md:col-span-3 xl:col-span-3">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[var(--surface)] p-3 sticky top-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={()=>{setGroup("data"); setPrefill(null);}}
                className={"px-3 py-1.5 rounded-md text-sm " + (group==="data" ? "bg-zinc-900 text-white" : "border")}>
                Data Eng
              </button>
              <button onClick={()=>{setGroup("feature"); setPrefill(null);}}
                className={"px-3 py-1.5 rounded-md text-sm " + (group==="feature" ? "bg-zinc-900 text-white" : "border")}>
                Feature Eng
              </button>
            </div>

            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
              {group === "data" ? "Data Engineering Tasks" : "Feature Engineering Tasks"}
            </div>

            <nav className="space-y-1">
              {tasks.map(t => (
                <button key={t.id} onClick={()=>{ setActive(t.id); setPrefill(null); }}
                  className={
                    "w-full text-left px-3 py-2 rounded-lg border transition " +
                    (active===t.id ? "border-zinc-900 dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-900/40"
                                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30")
                  }>
                  <div className="text-sm font-medium">{t.label}</div>
                  {t.note ? <div className="text-xs text-zinc-500">{t.note}</div> : null}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* MAIN */}
        <section className="col-span-12 md:col-span-9 xl:col-span-9 space-y-4">
          <Card
            title="Recommendations"
            subtitle="Heuristic suggestions based on missingness, skew, variation, outliers, cardinality and duplicates."
            right={<div className="text-xs text-zinc-500">{suggestions.length ? `${suggestions.length} suggestions` : "No obvious issues"}</div>}
          >
            <div className="space-y-3">
              {suggestions.length ? suggestions.map((s, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div>
                    <div className="font-medium">{s.label} <span className="text-xs text-zinc-500">({Math.round(s.confidence*100)}% conf.)</span></div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">{s.reason}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" onClick={()=>jumpTo(s)}>Go to task</Button>
                    {s.prefill ? <Button onClick={()=>jumpTo(s)}>Prefill</Button> : null}
                  </div>
                </div>
              )) : (<div className="text-sm text-zinc-500">All good! No suggestions at the moment.</div>)}
            </div>
          </Card>

          {group==="data"
            ? <DataTask id={active} prefill={prefill} onPreview={handlePreview} onApply={handleApply}/>
            : <FeatureTask id={active} prefill={prefill} onPreview={handlePreview} onApply={handleApply}/>
          }

          <Card title="Preview Output" subtitle="Response from /api/engineering/preview">
            <pre className="text-xs overflow-auto whitespace-pre-wrap">{busy ? "Running..." : JSON.stringify(preview, null, 2)}</pre>
          </Card>
        </section>
      </div>
    </main>
  );
}

/** ------- Panels (accept prefill + handlers) ------- */
function DataTask({ id, prefill, onPreview, onApply }:{
  id: TaskId; prefill: Record<string, any> | null;
  onPreview: (task: TaskId, payload: any)=>void;
  onApply: (task: TaskId, payload: any)=>void;
}) {
  switch (id) {
    case "impute":    return <ImputePanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "skew":      return <SkewPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "log1p":     return <Log1pPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "outliers":  return <OutliersPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "clip":      return <ClipPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "dedupe":    return <DedupePanel onPreview={onPreview} onApply={onApply}/>;
    case "scaling":   return <ScalingPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    default:          return <Card title="Select a task">Pick a task on the left.</Card>;
  }
}
function FeatureTask({ id, prefill, onPreview, onApply }:{
  id: TaskId; prefill: Record<string, any> | null;
  onPreview: (task: TaskId, payload: any)=>void;
  onApply: (task: TaskId, payload: any)=>void;
}) {
  switch (id) {
    case "formula":      return <FormulaPanel onPreview={onPreview} onApply={onApply}/>;
    case "target":       return <TargetPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "encoding":     return <EncodingPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "binning":      return <BinningPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "interactions": return <InteractionsPanel onPreview={onPreview} onApply={onApply}/>;
    case "dateparts":    return <DatePartsPanel prefill={prefill} onPreview={onPreview} onApply={onApply}/>;
    case "polynomial":   return <PolynomialPanel onPreview={onPreview} onApply={onApply}/>;
    default:             return <Card title="Select a task">Pick a task on the left.</Card>;
  }
}

/** ---------------------- Data panels ---------------------- */
function ImputePanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [method, setMethod] = useState(prefill?.method || "Mean");
  const [constant, setConstant] = useState(prefill?.constant || "");
  return (
    <Card title="Impute Missing" subtitle="Fill NaNs for selected numeric columns.">
      <Row cols={3}>
        <Field label="Columns (comma-sep)"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, COGS"/></Field>
        <Field label="Method">
          <select className="px-2 py-1.5 rounded-md border" value={method} onChange={e=>setMethod(e.target.value)}>
            <option>Mean</option><option>Median</option><option>Mode</option><option>Max</option><option>Min</option><option>Constant</option>
          </select>
        </Field>
        <Field label="Constant (if chosen)"><input className="px-2 py-1.5 rounded-md border" value={constant} onChange={e=>setConstant(e.target.value)} placeholder="0"/></Field>
      </Row>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={()=>onPreview("impute", { cols, method, constant })}>Preview</Button>
        <Button onClick={()=>onApply("impute", { cols, method, constant })}>Apply</Button>
      </div>
    </Card>
  );
}
function SkewPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [det, setDet] = useState("Pearson (Fisher)");
  const [treat, setTreat] = useState("Suggest only");
  return (
    <Card title="Skew / Normality" subtitle="Detect skewness and suggest fixes.">
      <Row cols={3}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, COGS"/></Field>
        <Field label="Detection"><select className="px-2 py-1.5 rounded-md border" value={det} onChange={e=>setDet(e.target.value)}><option>Pearson (Fisher)</option><option>D’Agostino K²</option><option>Jarque–Bera</option></select></Field>
        <Field label="Treat"><select className="px-2 py-1.5 rounded-md border" value={treat} onChange={e=>setTreat(e.target.value)}><option>Suggest only</option><option>Auto fix (log/boxcox)</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("skew", { cols, det, treat })}>Compute</Button><Button onClick={()=>onApply("skew", { cols, det, treat })}>Apply</Button></div>
    </Card>
  );
}
function Log1pPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [only, setOnly] = useState(prefill?.onlyIfSkewed ? "Yes" : "No");
  return (
    <Card title="Log1p Transform" subtitle="Apply log(1+x) to reduce long right tails.">
      <Row cols={2}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, COGS"/></Field>
        <Field label="Only if positively skewed?"><select className="px-2 py-1.5 rounded-md border" value={only} onChange={e=>setOnly(e.target.value)}><option>Yes</option><option>No</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("log1p", { cols, only })}>Preview</Button><Button onClick={()=>onApply("log1p", { cols, only })}>Apply</Button></div>
    </Card>
  );
}
function OutliersPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  the past, the explanation should be retrieved from the Cache. Additionally, as delete cache option should be provided in case I want to re-run the explanation. I would also want to see cross encoder details like relevance scores, details of re-ranking and retrieval relevance scores with clear english explanation explaining what each score means.
  const [method, setMethod] = useState(prefill?.method || "IQR (k=1.5)");
  const [treatment, setTreatment] = useState(prefill?.treatment || "Cap to bounds");
  return (
    <Card title="Outliers" subtitle="Detect & treat outliers by IQR or Z-score.">
      <Row cols={3}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, COGS"/></Field>
        <Field label="Method"><select className="px-2 py-1.5 rounded-md border" value={method} onChange={e=>setMethod(e.target.value)}><option>IQR (k=1.5)</option><option>Z-score (|z|>3)</option></select></Field>
        <Field label="Treatment"><select className="px-2 py-1.5 rounded-md border" value={treatment} onChange={e=>setTreatment(e.target.value)}><option>Cap to bounds</option><option>Remove rows</option><option>Impute (median)</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("outliers", { cols, method, treatment })}>Preview</Button><Button onClick={()=>onApply("outliers", { cols, method, treatment })}>Apply</Button></div>
    </Card>
  );
}
function ClipPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [min, setMin] = useState(prefill?.min ?? "");
  const [max, setMax] = useState(prefill?.max ?? "");
  return (
    <Card title="Clip" subtitle="Clamp values to min/max thresholds.">
      <Row cols={3}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, COGS"/></Field>
        <Field label="Min"><input type="number" className="px-2 py-1.5 rounded-md border" value={min} onChange={e=>setMin(e.target.value)} placeholder="0"/></Field>
        <Field label="Max"><input type="number" className="px-2 py-1.5 rounded-md border" value={max} onChange={e=>setMax(e.target.value)} placeholder="1000"/></Field>
      </Row>
      <div className="mt-2 text-sm text-zinc-500">Inclusive bounds; leave blank to keep unbounded on one side.</div>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("clip", { cols, min, max })}>Preview</Button><Button onClick={()=>onApply("clip", { cols, min, max })}>Apply</Button></div>
    </Card>
  );
}
function DedupePanel({ onPreview, onApply }:{ onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [subset, setSubset] = useState("");
  const [keep, setKeep] = useState("first");
  const [cs, setCs] = useState("Yes");
  return (
    <Card title="Dedupe" subtitle="Drop duplicate rows (exact match on subset).">
      <Row cols={3}>
        <Field label="Subset columns (optional)"><input className="px-2 py-1.5 rounded-md border" value={subset} onChange={e=>setSubset(e.target.value)} placeholder="id, date, sku"/></Field>
        <Field label="Keep"><select className="px-2 py-1.5 rounded-md border" value={keep} onChange={e=>setKeep(e.target.value)}><option>first</option><option>last</option></select></Field>
        <Field label="Case sensitive?"><select className="px-2 py-1.5 rounded-md border" value={cs} onChange={e=>setCs(e.target.value)}><option>Yes</option><option>No</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("dedupe", { subset, keep, caseSensitive: cs==="Yes" })}>Preview</Button><Button onClick={()=>onApply("dedupe", { subset, keep, caseSensitive: cs==="Yes" })}>Apply</Button></div>
    </Card>
  );
}
function ScalingPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [method, setMethod] = useState(prefill?.method || "Standard (z-score)");
  const [range, setRange] = useState("0,1");
  return (
    <Card title="Scaling" subtitle="Normalize feature scales for models.">
      <Row cols={3}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="numeric columns"/></Field>
        <Field label="Method"><select className="px-2 py-1.5 rounded-md border" value={method} onChange={e=>setMethod(e.target.value)}><option>Standard (z-score)</option><option>Min-Max [0,1]</option><option>Robust (IQR)</option></select></Field>
        <Field label="Range (Min-Max)"><input className="px-2 py-1.5 rounded-md border" value={range} onChange={e=>setRange(e.target.value)} placeholder="0,1"/></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("scaling", { cols, method, range })}>Preview</Button><Button onClick={()=>onApply("scaling", { cols, method, range })}>Apply</Button></div>
    </Card>
  );
}

/** ---------------------- Feature panels ---------------------- */
function TargetPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const all = demoCols.numeric.concat(demoCols.categorical);
  const [target, setTarget] = useState(prefill?.target || all[0]);
  const [ptype, setPtype] = useState("Auto (infer)");
  const [split, setSplit] = useState("80/20");
  return (
    <Card title="Target Column" subtitle="Choose label/target used by modeling & NLQ.">
      <Row cols={3}>
        <Field label="Target"><select className="px-2 py-1.5 rounded-md border" value={target} onChange={e=>setTarget(e.target.value)}>{all.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Problem Type"><select className="px-2 py-1.5 rounded-md border" value={ptype} onChange={e=>setPtype(e.target.value)}><option>Auto (infer)</option><option>Regression</option><option>Classification</option><option>Forecasting</option></select></Field>
        <Field label="Train / Test split"><input className="px-2 py-1.5 rounded-md border" value={split} onChange={e=>setSplit(e.target.value)} /></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("target", { target, ptype, split })}>Preview</Button><Button onClick={()=>onApply("target", { target, ptype, split })}>Set as Default</Button></div>
    </Card>
  );
}
function EncodingPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(prefill?.cols || "");
  const [method, setMethod] = useState(prefill?.method || "One-Hot (drop first)");
  const [smoothing, setSmoothing] = useState(prefill?.smoothing ?? "10");
  return (
    <Card title="Encoding" subtitle="Categoricals → numeric features.">
      <Row cols={3}>
        <Field label="Columns (categorical)"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Category, City"/></Field>
        <Field label="Method"><select className="px-2 py-1.5 rounded-md border" value={method} onChange={e=>setMethod(e.target.value)}><option>One-Hot (drop first)</option><option>One-Hot (full)</option><option>Target Encoding</option><option>Hashing</option></select></Field>
        <Field label="Smoothing (target enc.)"><input className="px-2 py-1.5 rounded-md border" value={smoothing} onChange={e=>setSmoothing(e.target.value)} placeholder="10"/></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("encoding", { cols, method, smoothing })}>Preview</Button><Button onClick={()=>onApply("encoding", { cols, method, smoothing })}>Apply</Button></div>
    </Card>
  );
}
function BinningPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [column, setColumn] = useState(prefill?.column || "");
  const [bins, setBins] = useState(10);
  const [strategy, setStrategy] = useState("Equal Width");
  return (
    <Card title="Binning" subtitle="Make buckets for numeric stability.">
      <Row cols={3}>
        <Field label="Column"><input className="px-2 py-1.5 rounded-md border" value={column} onChange={e=>setColumn(e.target.value)} placeholder="Revenue"/></Field>
        <Field label="# Bins"><input type="number" className="px-2 py-1.5 rounded-md border" value={bins} onChange={e=>setBins(Number(e.target.value))}/></Field>
        <Field label="Strategy"><select className="px-2 py-1.5 rounded-md border" value={strategy} onChange={e=>setStrategy(e.target.value)}><option>Equal Width</option><option>Equal Frequency (Quantile)</option><option>K-Means</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("binning", { column, bins, strategy })}>Preview</Button><Button onClick={()=>onApply("binning", { column, bins, strategy })}>Apply</Button></div>
    </Card>
  );
}
function InteractionsPanel({ onPreview, onApply }:{ onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [out, setOut] = useState("FeatureA_x_FeatureB");
  return (
    <Card title="Interactions" subtitle="Cross features (pairwise).">
      <Row cols={3}>
        <Field label="Feature A"><input className="px-2 py-1.5 rounded-md border" value={a} onChange={e=>setA(e.target.value)} placeholder="Category"/></Field>
        <Field label="Feature B"><input className="px-2 py-1.5 rounded-md border" value={b} onChange={e=>setB(e.target.value)} placeholder="Region"/></Field>
        <Field label="Output name"><input className="px-2 py-1.5 rounded-md border" value={out} onChange={e=>setOut(e.target.value)} placeholder="Category_x_Region"/></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("interactions", { a, b, out })}>Preview</Button><Button onClick={()=>onApply("interactions", { a, b, out })}>Create</Button></div>
    </Card>
  );
}
function DatePartsPanel({ prefill, onPreview, onApply }:{ prefill?: any; onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [column, setColumn] = useState(prefill?.column || "");
  const [parts, setParts] = useState((prefill?.parts||["year","month","dow"]).join(", "));
  const [onehot, setOnehot] = useState("No");
  const [tz, setTz] = useState("UTC");
  return (
    <Card title="Date Parts" subtitle="Extract year/month/quarter/DOW from a timestamp.">
      <Row cols={4}>
        <Field label="Datetime column"><input className="px-2 py-1.5 rounded-md border" value={column} onChange={e=>setColumn(e.target.value)} placeholder="Date"/></Field>
        <Field label="Parts"><input className="px-2 py-1.5 rounded-md border" value={parts} onChange={e=>setParts(e.target.value)} placeholder="year, month, dow"/></Field>
        <Field label="One-hot DOW?"><select className="px-2 py-1.5 rounded-md border" value={onehot} onChange={e=>setOnehot(e.target.value)}><option>No</option><option>Yes</option></select></Field>
        <Field label="Timezone (optional)"><input className="px-2 py-1.5 rounded-md border" value={tz} onChange={e=>setTz(e.target.value)} placeholder="UTC"/></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("dateparts", { column, parts: parts.split(",").map(s=>s.trim()).filter(Boolean), onehot: onehot==="Yes", tz })}>Preview</Button><Button onClick={()=>onApply("dateparts", { column, parts: parts.split(",").map(s=>s.trim()).filter(Boolean), onehot: onehot==="Yes", tz })}>Apply</Button></div>
    </Card>
  );
}
function PolynomialPanel({ onPreview, onApply }:{ onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [cols, setCols] = useState(""); const [deg, setDeg] = useState(2); const [inter, setInter] = useState("Yes");
  return (
    <Card title="Polynomial Features" subtitle="Create degree-k expansions for numeric columns.">
      <Row cols={3}>
        <Field label="Columns"><input className="px-2 py-1.5 rounded-md border" value={cols} onChange={e=>setCols(e.target.value)} placeholder="Revenue, Quantity"/></Field>
        <Field label="Degree"><input type="number" className="px-2 py-1.5 rounded-md border" value={deg} onChange={e=>setDeg(Number(e.target.value))}/></Field>
        <Field label="Include interactions?"><select className="px-2 py-1.5 rounded-md border" value={inter} onChange={e=>setInter(e.target.value)}><option>Yes</option><option>No</option></select></Field>
      </Row>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={()=>onPreview("polynomial", { cols, deg, interactions: inter==="Yes" })}>Preview</Button><Button onClick={()=>onApply("polynomial", { cols, deg, interactions: inter==="Yes" })}>Apply</Button></div>
    </Card>
  );
}

/** ---------------------- Formula Builder ---------------------- */
type FormulaRow = { name: string; expr: string };
function FormulaPanel({ onPreview, onApply }:{ onPreview:(t:TaskId,p:any)=>void; onApply:(t:TaskId,p:any)=>void }) {
  const [rows, setRows] = useState<FormulaRow[]>([{ name: "GrossMargin", expr: "(Revenue - COGS) / Revenue" }]);
  function add() { setRows(r => [...r, { name: "", expr: "" }]); }
  function remove(i: number) { setRows(r => r.filter((_, idx) => idx !== i)); }
  function update(i: number, patch: Partial<FormulaRow>) { setRows(r => r.map((row, idx) => idx===i ? { ...row, ...patch } : row)); }
  function payload() { return { formulas: rows.filter(r => r.name.trim() && r.expr.trim()) }; }
  return (
    <Card title="Feature Engineering — Formula Builder" subtitle="Define new features from existing columns (use num_ColName to coerce to number).">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <div className="col-span-12 md:col-span-4"><Field label="New column name"><input className="px-2 py-1.5 rounded-md border w-full" value={r.name} onChange={e=>update(i,{name:e.target.value})} placeholder="GrossMargin"/></Field></div>
            <div className="col-span-12 md:col-span-7"><Field label="Formula"><input className="px-2 py-1.5 rounded-md border w-full" value={r.expr} onChange={e=>update(i,{expr:e.target.value})} placeholder="(Revenue - COGS) / Revenue"/></Field></div>
            <div className="col-span-12 md:col-span-1 flex items-end"><Button variant="outline" onClick={()=>remove(i)}>Remove</Button></div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" onClick={add}>+ Add formula</Button>
          <Button variant="outline" onClick={()=>onPreview("formula", payload())}>Preview</Button>
          <Button onClick={()=>onApply("formula", payload())}>Apply to Dataset</Button>
        </div>
      </div>
    </Card>
  );
}
