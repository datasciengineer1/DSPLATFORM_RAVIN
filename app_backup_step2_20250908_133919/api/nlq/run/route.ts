import { NextResponse } from "next/server";
import { loadDatasetSync } from "@/utils/datasets";
import { chooseSeries } from "@/utils/series";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  datasetId?: string;
  id?: string;
  q?: string;
  question?: string;
  target?: string;
  horizon?: number;
};

function detectTask(q: string): "forecast" | "regression" | "classify" {
  const s = (q || "").toLowerCase();
  if (/(forecast|next|future|trend)/.test(s)) return "forecast";
  if (/(classif|churn|probab|likelihood)/.test(s)) return "classify";
  return "regression";
}

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    const datasetId = body.datasetId || body.id;
    const q = String(body.q || body.question || "").trim();

    if (!datasetId) {
      return NextResponse.json(
        { ok: false, message: "datasetId is required" },
        { status: 400 }
      );
    }

    // Load dataset from the same store the EDA endpoints use
    const ds = loadDatasetSync(datasetId);
    const summaryLike = { preview: ds?.rows || [], fields: ds?.fields || {} };

    const task = detectTask(q);
    const series = chooseSeries(summaryLike, q);
    const target = body.target || series.label;

    const explain = [
      `You asked: ${q || "(no question)"} .`,
      task === "forecast"
        ? `Task: forecast. A numeric target **${target}** was detected from your dataset.`
        : task === "classify"
        ? `Task: classification. Consider selecting a discrete target label.`
        : `Task: regression with numeric target **${target}**.`,
      series.values.length
        ? `We found ${series.values.filter(v => v != null).length} usable points.`
        : `No strong numeric series found; try choosing a different target in Model.`,
    ];

    return NextResponse.json({
      ok: true,
      question: q,
      task,
      target,
      series,     // {label, values, labels?}
      explain,    // string[]
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed to run NLQ" },
      { status: 500 }
    );
  }
}
