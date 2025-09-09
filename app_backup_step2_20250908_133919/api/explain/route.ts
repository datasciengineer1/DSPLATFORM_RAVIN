export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function quickExplain(question: string, ctx: any): string {
  try {
    const lines: string[] = [];
    const t = ctx?.task || "analysis";
    const L = ctx?.labels || {};
    const M = ctx?.metrics || {};
    lines.push(`### Summary for: ${question}`);
    lines.push("");

    if (t === "forecast") {
      const rmse = M?.rmse != null ? Number(M.rmse).toFixed(3) : "—";
      const mae  = M?.mae  != null ? Number(M.mae ).toFixed(3) : "—";
      lines.push(`**Task:** Forecasting **${L?.target ?? "target"}** over horizon **${L?.horizon ?? "—"}**`);
      lines.push(`**Error (lower is better):** RMSE=${rmse}, MAE=${mae}`);
      const hist = ctx?.charts?.history || [];
      const fut  = ctx?.charts?.future  || [];
      const lastAct = hist.length ? hist[hist.length-1] : null;
      const next1   = fut.length ? fut[0] : null;
      if (lastAct && next1) {
        lines.push(`Recent actual (${lastAct.t}): **${lastAct.actual ?? lastAct.forecast ?? "—"}**`);
        lines.push(`Next forecast (${next1.t}): **${next1.forecast ?? "—"}**`);
      }
      lines.push("");
      lines.push("**Interpretation:** Simple moving-average baseline; look for consistent gaps between actual and forecast to spot bias.");
    } else if (t === "regression") {
      const r2   = M?.r2   != null ? Number(M.r2).toFixed(3) : "—";
      const rmse = M?.rmse != null ? Number(M.rmse).toFixed(3) : "—";
      const top  = L?.topFeature ? ` (top driver: **${L.topFeature}**)` : "";
      lines.push(`**Task:** Regression on **${L?.target ?? "target"}**${top}`);
      lines.push(`**Fit quality:** R²=${r2}, RMSE=${rmse}`);
      const imp = (ctx?.charts?.importance || []).slice(0,5).map((d:any)=>`- ${d.name}: ${Number(d.value).toFixed(3)}`);
      if (imp.length) { lines.push("**Top drivers:**"); lines.push(...imp); }
      if ((ctx?.charts?.pdp || []).length) lines.push("**Partial dependence:** Monotonic trends suggest linear effects; non-monotonic patterns hint interactions.");
    } else if (t === "classification") {
      const acc = M?.accuracy != null ? Number(M.accuracy).toFixed(3) : "—";
      const pre = M?.precision!= null ? Number(M.precision).toFixed(3): "—";
      const rec = M?.recall   != null ? Number(M.recall).toFixed(3)   : "—";
      lines.push(`**Task:** Classification on **${L?.target ?? "target"}**`);
      lines.push(`**Quality:** Acc=${acc}, Prec=${pre}, Rec=${rec}`);
      const imp = (ctx?.charts?.importance || []).slice(0,5).map((d:any)=>`- ${d.name}: ${Number(d.value).toFixed(3)}`);
      if (imp.length) { lines.push("**Top signals:**"); lines.push(...imp); }
      if ((ctx?.charts?.confusion || []).length) lines.push("**Confusion matrix:** inspect FP vs FN to tune threshold.");
    } else {
      lines.push("**General analysis:** No specialized task detected; showing basic context.");
    }

    const hints = ctx?.hints;
    if (Array.isArray(hints?.numericColumns) && hints.numericColumns.length) {
      lines.push(""); lines.push(`**Numeric candidates:** ${hints.numericColumns.slice(0,12).join(", ")}`);
    }
    return lines.join("\n");
  } catch {
    return `High-level explanation based on available metrics and charts for: ${question}`;
  }
}

export async function POST(req: Request) {
  const { question, context } = await req.json();
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1";
  const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || "25000", 10);

  const prompt = [
    "You are a sharp, succinct data science explainer.",
    "Write a clear, decision-oriented explanation with short sections and bullets.",
    "Do NOT invent metrics. Only use the context given.",
    "",
    `Question: ${question}`,
    "Context JSON:",
    typeof context === "string" ? context : JSON.stringify(context, null, 2),
  ].join("\n");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(`${host}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        keep_alive: "1h",
        options: { temperature: 0.3, num_predict: 400 }
      }),
    });
    clearTimeout(t);

    if (!r.ok) {
      const msg = await r.text();
      // Fallback on model error
      return new Response(JSON.stringify({
        answer: quickExplain(question, context),
        warning: `Ollama error: ${msg}`,
        usedFallback: true
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    const data = await r.json();
    const answer = (data && data.response) ? String(data.response) : "";
    return new Response(JSON.stringify({ answer }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    clearTimeout(t);
    // Timeout / network / abort -> graceful fallback
    return new Response(JSON.stringify({
      answer: quickExplain(question, context),
      warning: String(e?.message || e),
      usedFallback: true
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
}
