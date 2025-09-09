import { NextResponse } from "next/server";
import { ExplainStruct, emptyStruct, repairStruct } from "@/app/lib/explain_schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetrievalHit = { question:string; contributions?:{dense?:number;sparse?:number;cross?:number;combined?:number} };

function buildSystemPrompt(){
  return `You are a senior data scientist. Return ONLY JSON. Schema:
{
  "category": "forecasting"|"regression"|"classification"|"segmentation"|"anomaly"|"ranking",
  "confidence": "Low"|"Medium"|"High",
  "kpi_impact": [{"kpi": string, "direction": "up"|"down"|"flat", "magnitude": "low"|"med"|"high", "why": string}],
  "what": string,
  "why": string,
  "how": string[],
  "risks": string[],
  "mitigation": [{"action": string, "mechanism"?: string, "expected_direction"?: string, "effort"?: "low"|"med"|"high", "timeframe"?: string, "risk"?: string}],
  "next_steps": [{"step": string, "owner"?: string, "effort"?: "low"|"med"|"high", "timeframe"?: string}],
  "assumptions"?: string[]
}
Rules:
- Always include 5–6 KPI rows (profit margin, revenue, COGS, conversion/churn, units, etc as relevant).
- Pick a category and confidence explicitly.
- Use short business sentences.`;
}

function retrievalBullets(hits: RetrievalHit[]|undefined){
  if(!hits?.length) return "- No strong matches.";
  const top = hits.slice(0,3).map(h=>{
    const c = h.contributions || {};
    const f =(v?:number)=> v===undefined? "—" : (typeof v==="number" ? v.toFixed(2) : "—");
    return `- “${h.question}” (cos=${f(c.dense)}, sparse=${f(c.sparse)}, cross=${f(c.cross)})`;
  }).join("\n");
  return top;
}

function guessCategory(q:string): ExplainStruct["category"] {
  const s = q.toLowerCase();
  if (/(forecast|time series|seasonality|next\s+\d+)/.test(s)) return "forecasting";
  if (/(classif|will|churn|survive|segment)/.test(s)) return "classification";
  if (/(cluster|segment)/.test(s)) return "segmentation";
  if (/(anomaly|outlier)/.test(s)) return "anomaly";
  return "regression";
}

function deriveConfidence(hits: RetrievalHit[]|undefined): "Low"|"Medium"|"High" {
  if(!hits?.length) return "Low";
  const best = Math.max(...hits.map(h=> Number(h.contributions?.combined ?? 0)));
  if (best >= 0.75) return "High";
  if (best >= 0.45) return "Medium";
  return "Low";
}

function padKpis(nlq:string, s:ExplainStruct){
  const want = 5;
  const have = s.kpi_impact?.length || 0;
  if (have >= want) return;
  const t = (nlq||"").toLowerCase();
  const neg = /(negative|declin|drop|down|loss)/.test(t);
  const pos = /(increase|growth|improv|up)/.test(t);
  const candidates = [
    { kpi:"Profit margin", direction: neg ? "down":"flat", magnitude: neg ? "high":"med", why:"Margin is sensitive to COGS and pricing mix." },
    { kpi:"Revenue",       direction: neg ? "down": pos ? "up":"flat", magnitude: pos ? "med":"low", why:"Demand, pricing and channel mix drive topline." },
    { kpi:"COGS",          direction: neg ? "up":"flat", magnitude: neg ? "high":"med", why:"Supplier/input costs move margins inversely." },
    { kpi:"Units / Volume",direction: pos ? "up":"flat", magnitude: "med", why:"Volume reflects demand & seasonality." },
    { kpi:"Conversion / Churn",direction: neg ? "down":"flat", magnitude:"low", why:"Customer behavior affects revenue efficiency." },
  ] as any[];
  const existing = (s.kpi_impact||[]).map(r=>(r.kpi||"").toLowerCase());
  for (const c of candidates) {
    if (s.kpi_impact.length >= want) break;
    if (!existing.includes(c.kpi.toLowerCase())) s.kpi_impact.push(c);
  }
}

// robust JSON parse
function parseJsonLoose(s:string): any|null {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}$/m);
  if(m) { try { return JSON.parse(m[0]); } catch {} }
  const all = s.match(/\{[\s\S]*\}/g);
  if(all) { for(const cand of all){ try { return JSON.parse(cand); } catch {} } }
  return null;
}

export async function POST(req: Request){
  const body = await req.json().catch(()=> ({} as any));
  const nlq      = (body?.nlq ?? "").toString();
  const detail   = (body?.detail ?? "deep").toString();
  const retrieval= body?.retrieval || {};
  const model    = process.env.EXPLAINER_MODEL || "mistral";

  try {
    const r = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        model,
        prompt: `${buildSystemPrompt()}

Question: """${nlq}"""
Retrieval evidence:
${retrievalBullets(retrieval?.hits) || "-"}
Write a ${(detail==="short")?"brief": detail==="standard"?"standard":"deep"} analysis as JSON only.`,
        stream: false,
        options: { temperature: 0.2, num_ctx: 4096 },
        format: "json"
      })
    });
    const raw = await r.text();
    const parsed = parseJsonLoose(raw);
    let structured: ExplainStruct = parsed ? repairStruct(parsed) : repairStruct(emptyStruct());

    // ensure required fields present
    if (!structured.category)   structured.category   = guessCategory(nlq);
    if (!structured.confidence) structured.confidence = deriveConfidence(retrieval?.hits);
    padKpis(nlq, structured);

    return NextResponse.json({ ok:true, provider:"ollama", model, structured });
  } catch (e:any) {
    const s = repairStruct(emptyStruct());
    s.category = guessCategory(nlq);
    s.confidence = deriveConfidence(retrieval?.hits);
    padKpis(nlq, s);
    return NextResponse.json({ ok:false, provider:"stub", model:"-", structured:s, error: String(e?.message||e) });
  }
}

export async function GET(){ return NextResponse.json({ ok:true }); }
