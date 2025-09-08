import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { task, payload } = await req.json();

  const summary = (() => {
    switch (task) {
      case "impute": return `Would impute ${payload.cols || "(no cols)"} using ${payload.method}${payload.method==="Constant" ? `=${payload.constant ?? 0}`: ""}.`;
      case "skew": return `Would compute skew on ${payload.cols || "(no cols)"} with ${payload.det}.`;
      case "log1p": return `Would apply log1p to ${payload.cols || "(no cols)"} ${payload.only==="Yes" ? "if right-skewed" : ""}.`;
      case "outliers": return `Would detect outliers in ${payload.cols || "(no cols)"} via ${payload.method}; treatment=${payload.treatment}.`;
      case "clip": return `Would clip ${payload.cols || "(no cols)"} to [${payload.min ?? "-∞"}, ${payload.max ?? "+∞"}].`;
      case "dedupe": return `Would drop duplicates keep=${payload.keep} subset=${payload.subset || "(all)"}.`;
      case "scaling": return `Would scale ${payload.cols || "(no cols)"} using ${payload.method}${payload.method.includes("Min-Max") ? ` range ${payload.range}`:""}.`;
      case "formula": return `Would create ${Array.isArray(payload.formulas)?payload.formulas.length:0} derived feature(s).`;
      case "target": return `Would set target=${payload.target} type=${payload.ptype} split=${payload.split}.`;
      case "encoding": return `Would encode ${payload.cols || "(no cols)"} using ${payload.method}.`;
      case "binning": return `Would bin ${payload.column} into ${payload.bins} bins (${payload.strategy}).`;
      case "interactions": return `Would create interaction ${payload.a} × ${payload.b} -> ${payload.out}.`;
      case "dateparts": return `Would extract ${Array.isArray(payload.parts)?payload.parts.join(", "):payload.parts} from ${payload.column} tz=${payload.tz}.`;
      case "polynomial": return `Would expand ${payload.cols || "(no cols)"} to degree ${payload.deg} interactions=${payload.interactions}.`;
      default: return `Unknown task "${task}".`;
    }
  })();

  return NextResponse.json({ ok: true, task, summary, echo: payload }, { status: 200 });
}
