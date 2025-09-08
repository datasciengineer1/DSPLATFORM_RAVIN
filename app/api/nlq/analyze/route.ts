import { NextResponse } from "next/server";

/**
 * Very lightweight NLQ:
 * - Detects forecast if "forecast" or "next <n>" appears
 * - Extracts [target=...] if present
 * - Extracts numeric horizon from "next N (months|quarters|weeks|days|years)"
 */
export async function POST(req: Request) {
  const { question } = await req.json();
  const q = String(question || "").toLowerCase();

  const targetMatch = /\[target\s*=\s*([^\]]+)\]/i.exec(question || "");
  const target = targetMatch?.[1]?.trim() || null;

  let task: "forecast" | "regression" | "classification" = "regression";
  let horizon: number | null = null;

  const forecastRegex = /(forecast|next\s+\d+)/i;
  if (forecastRegex.test(question || "")) task = "forecast";

  const hz = /next\s+(\d+)\s*(day|week|month|quarter|year|days|weeks|months|quarters|years)?/i.exec(question || "");
  if (hz) {
    horizon = parseInt(hz[1], 10);
    if (!Number.isFinite(horizon)) horizon = null;
  }

  // Classification hint keywords (kept simple; regression is fallback)
  const classWords = /(probability|risk|will|survive|churn|default|win|lose)/i;
  if (classWords.test(question || "") && !forecastRegex.test(question || "")) {
    task = "classification";
  }

  return NextResponse.json({
    task,
    target,
    horizon,
    reason: task === "forecast" ? "Detected 'forecast' or 'next N' in question." :
            task === "classification" ? "Detected classification keywords." :
            "Defaulted to regression.",
  });
}
