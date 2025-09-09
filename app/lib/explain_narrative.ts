import type { ExplainStruct } from "./explain_schema";

export function expandStructToMarkdown(s: ExplainStruct, detail:"short"|"standard"|"deep"="deep"): string {
  const k = s.kpi_impact||[];
  const bullets = (arr?:string[], prefix="- ")=>(arr&&arr.length? arr.map(x=>`${prefix}${x}`).join("\n") : `${prefix}—`);
  const mitig = (s.mitigation||[]).map(m=>`- **${m.action}**${m.mechanism?`: ${m.mechanism}`:""}${m.expected_direction?` _(expected: ${m.expected_direction})_`:""}${m.effort?` · effort: ${m.effort}`:""}${m.timeframe?` · ${m.timeframe}`:""}${m.risk?` · risk: ${m.risk}`:""}`).join("\n") || "- —";
  const steps = (s.next_steps||[]).map(n=>`1. ${n.step}${n.owner?` _(owner: ${n.owner})_`:""}${n.effort?` · effort: ${n.effort}`:""}${n.timeframe?` · ${n.timeframe}`:""}`).join("\n") || "1. —";

  const kpiLines = k.length ? k.map(row=>{
    const dir = row.direction==="up"?"▲ up":row.direction==="down"?"▼ down":"→ flat";
    const mag = row.magnitude==="high"?"High":row.magnitude==="med"?"Medium":"Low";
    return `- **${row.kpi}** — ${dir}, ${mag} impact. _Why_: ${row.why}`;
  }).join("\n") : "- —";

  const depthNote = detail==="short" ? "_(brief)_" : detail==="standard" ? "_(standard)_" : "_(deep)_";

  return [
    `### Executive summary ${depthNote}`,
    s.what || "—",
    "",
    "### Drivers (why)",
    s.why || "—",
    "",
    "### KPI impact (structured)",
    kpiLines,
    "",
    "### How to analyze",
    bullets(s.how),
    "",
    "### Strategies / Mitigation",
    mitig,
    "",
    "### Assumptions & limits",
    bullets((s.assumptions||[]).concat(s.risks||[])),
    "",
    "### Next best steps",
    steps
  ].join("\n");
}
