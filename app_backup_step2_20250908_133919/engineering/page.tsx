"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LeftPanel, RightPanel, PanelCard } from "../components/SidePanels";
import { useActiveDataset } from "../components/useActiveDataset";

async function postJSON(path: string, body?: any) {
  const init: RequestInit = body
    ? { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }
    : { method:'GET' } as any;
  const res = await fetch(path, init as any);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function EngineeringPage(){
  const { id, name } = useActiveDataset();
  const datasetId = id || "demo";
  const datasetName = name || null;

  // ---- Recommendations ----
  const [recs, setRecs] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  useEffect(()=>{
    let ignore=false;
    (async()=>{
      try{
        const r = await (await fetch(`/api/engineering/recommend?datasetId=${encodeURIComponent(String(datasetId))}`)).json();
        if (!ignore) setRecs(r.recommendations||[]);
      } catch {/*ignore*/}
    })();
    return ()=>{ignore=true}
  }, [datasetId]);

  const grouped = useMemo(()=>{
    const g:Record<string, any[]> = {};
    for (const r of recs) (g[r.type] = g[r.type] || []).push(r);
    return g;
  }, [recs]);

  async function applySelected(){
    const tasks:any[] = [];
    const pick = (id:string)=> selected[id];
    for (const r of recs){
      const key = `${r.type}:${r.column||r.columns||r.rows}`;
      if (!pick(key)) continue;
      if (r.type==='impute'){
        tasks.push({ type:'impute', method: r.suggestion==='median'?'median':(r.suggestion==='mode'?'mode':'mean'), columns:[r.column] });
      } else if (r.type==='skew') {
        tasks.push({ type:'log1p', columns:[r.column] });
      } else if (r.type==='outliers') {
        tasks.push({ type:'clip', z:3, columns:[r.column] });
      } else if (r.type==='duplicates') {
        tasks.push({ type:'dedupe' });
      } else if (r.type==='scaling') {
        tasks.push({ type:'standardize', columns: [] }); // will be ignored unless UI specifies columns; left here for completeness
      }
    }
    if (!tasks.length) return;
    await postJSON('/api/engineering/apply', { datasetId, tasks });
    // refresh recs
    const r = await (await fetch(`/api/engineering/recommend?datasetId=${encodeURIComponent(String(datasetId))}`)).json();
    setRecs(r.recommendations||[]);
    setSelected({});
    alert('Selected data engineering fixes applied.');
  }

  // ---- Feature formulas ----
  const [formulas, setFormulas] = useState<{name:string, expr:string}[]>([
    { name:'GrossMargin', expr:'(Revenue - COGS) / Revenue' }
  ]);

  function addRow(){ setFormulas(f=> f.concat({ name:'NewFeature', expr:'num_Sales * 1.0' })); }
  function updateRow(i:number, key:'name'|'expr', val:string){ setFormulas(f=> f.map((r,idx)=> idx===i ? {...r, [key]: val} : r)); }
  function removeRow(i:number){ setFormulas(f=> f.filter((_,idx)=> idx!==i )); }

  async function applyFormulas(){
    const transforms = formulas.filter(f=>f.name && f.expr);
    if (!transforms.length) return;
    await postJSON('/api/engineering/transform', { datasetId, transforms });
    alert('New features added to dataset. You can proceed to NLQ/Model.');
  }

  // side panel explain text
  const explain = [
    "Add derived columns using spreadsheet-like formulas:",
    "- Use existing column names (case-sensitive).",
    "- Also available: numeric aliases like num_Sales, num_Revenue (coerced).",
    "- Functions allowed by expr-eval: +, -, *, /, ^, log, sqrt, min, max…",
    "Examples:",
    "GrossMargin = (Revenue - COGS) / Revenue",
    "RevPerUnit  = Revenue / Units",
    "LogSales    = log(1 + num_Sales)"
  ];

  return (
    <main className="container mx-auto px-4 py-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 mb-4">
        <div className="p-3 flex flex-wrap gap-2 items-center">
          <Link href="/workspace" className="px-3 py-1.5 rounded-full border">1. Data</Link>
          <Link href="/workspace" className="px-3 py-1.5 rounded-full border">2. EDA</Link>
          <span className="px-3 py-1.5 rounded-full border bg-blue-600 text-white">3. Engineering</span>
          <Link href="/nlq" className="px-3 py-1.5 rounded-full border">4. NLQ</Link>
          <Link href="/model" className="px-3 py-1.5 rounded-full border">5. Model</Link>
          <Link href="/predict" className="px-3 py-1.5 rounded-full border">6. Predict/Explain</Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <LeftPanel explainList={explain} />

        <div className="col-span-12 xl:col-span-6 space-y-4">
          <PanelCard title="Feature Engineering — Formula Builder">
            <div className="space-y-3">
              <div className="text-sm text-zinc-600">Define new features from existing columns. Use <code>num_ColName</code> to coerce to number.</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-xl overflow-hidden">
                  <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2 text-left">New column name</th>
                      <th className="px-3 py-2 text-left">Formula</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formulas.map((r,i)=>(
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1" value={r.name} onChange={e=>updateRow(i,'name',e.target.value)} /></td>
                        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1" value={r.expr} onChange={e=>updateRow(i,'expr',e.target.value)} /></td>
                        <td className="px-3 py-2">
                          <button onClick={()=>removeRow(i)} className="px-2 py-1 rounded border">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button onClick={addRow} className="px-3 py-2 rounded-lg border">+ Add formula</button>
                <button onClick={applyFormulas} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Apply to Dataset</button>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Data Engineering — Smart Recommendations">
            <div className="space-y-3">
              {!recs.length ? <div className="text-sm text-zinc-500">Analyzing…</div> : (
                <div className="space-y-2">
                  {Object.keys(grouped).map(group=>(
                    <div key={group} className="border rounded-xl">
                      <div className="px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-900">{group}</div>
                      <div className="p-3 space-y-2">
                        {grouped[group].map((r:any, idx:number)=>{
                          const key = `${r.type}:${r.column||r.columns||r.rows}`;
                          return (
                            <label key={key} className="flex gap-2 items-start">
                              <input type="checkbox" checked={!!selected[key]} onChange={e=> setSelected(s=>({...s, [key]: e.target.checked}))} />
                              <div className="text-sm">
                                <div className="font-medium">{r.column || r.columns || ''}</div>
                                <div className="text-zinc-600">{r.suggestion || ''} {r.rate ? `(missing ${(r.rate*100).toFixed(1)}%)` : ''} {r.count ? `(outliers ${r.count})` : ''} {r.unique ? `(unique ${r.unique})` : ''}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={applySelected} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Apply Selected Basics</button>
              </div>
            </div>
          </PanelCard>

          <div className="flex justify-end gap-2">
            <Link href="/workspace" className="px-3 py-1.5 rounded-lg border">Back to EDA</Link>
            <Link href="/nlq" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Continue to NLQ</Link>
          </div>
        </div>

        <RightPanel datasetName={datasetName} />
      </div>
    </main>
  );
}
