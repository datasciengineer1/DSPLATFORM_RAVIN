export type KPI = { kpi:string; direction:"up"|"down"|"flat"; magnitude:"low"|"med"|"high"; why:string };
export type Mitigation = { action:string; mechanism?:string; expected_direction?:string; effort?:"low"|"med"|"high"; timeframe?:string; risk?:string };
export type NextStep = { step:string; owner?:string; effort?:"low"|"med"|"high"; timeframe?:string };
export type ExplainStruct = {
  category?: "forecasting"|"regression"|"classification"|"segmentation"|"anomaly"|"ranking";
  confidence?: "Low"|"Medium"|"High";
  kpi_impact: KPI[];
  what: string;  // business summary
  why: string;   // drivers/causal view
  how: string[]; // how to analyze
  risks: string[];
  mitigation: Mitigation[];
  next_steps: NextStep[];
  assumptions?: string[];
};

export function emptyStruct(): ExplainStruct {
  return {
    category: "regression",
    confidence: "Medium",
    kpi_impact: [],
    what: "We generated a structured business summary.",
    why: "Preliminary drivers inferred from similar questions and dataset context.",
    how: [
      "Validate schemas and missingness.",
      "Check seasonality/outliers.",
      "Run baseline with holdout."
    ],
    risks: ["Heuristic fallback used; refine with domain inputs."],
    mitigation: [
      { action: "Standardize features / clip outliers", effort: "low", timeframe: "short" },
      { action: "Add seasonality / holiday effects (if forecasting)", effort: "med", timeframe: "short" }
    ],
    next_steps: [
      { step: "Confirm KPI definitions & units", effort: "low", timeframe: "short" },
      { step: "Run AutoML baseline; review SHAP drivers", effort: "med", timeframe: "short" }
    ],
    assumptions: []
  };
}

export function repairStruct(x:any): ExplainStruct {
  const s = Object.assign(emptyStruct(), x||{});
  s.category = (x?.category)||s.category;
  s.confidence = (x?.confidence)||s.confidence;
  s.kpi_impact = Array.isArray(x?.kpi_impact) ? x.kpi_impact : [];
  s.what = (typeof x?.what==="string" && x.what.trim()) ? x.what : emptyStruct().what;
  s.why  = (typeof x?.why==="string" && x.why.trim()) ? x.why : emptyStruct().why;
  s.how = Array.isArray(x?.how) && x.how.length ? x.how : emptyStruct().how;
  s.risks = Array.isArray(x?.risks) ? x.risks : emptyStruct().risks;
  s.mitigation = Array.isArray(x?.mitigation) ? x.mitigation : emptyStruct().mitigation;
  s.next_steps = Array.isArray(x?.next_steps) && x.next_steps.length ? x.next_steps : emptyStruct().next_steps;
  s.assumptions = Array.isArray(x?.assumptions) ? x.assumptions : [];
  return s;
}
