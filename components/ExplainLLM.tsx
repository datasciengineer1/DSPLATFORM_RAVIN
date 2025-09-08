"use client";
import React from "react";
import Markdown from "@/app/components/ui/Markdown";

type Props = {
  question?: string;
  datasetId?: string;
  meta?: Record<string, any>;
  className?: string;
};

export default function ExplainLLM({ question, datasetId, meta, className }: Props) {
  const [text, setText] = React.useState<string>("Generating explanation…");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/explain/llm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, datasetId, meta }),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (alive) setText(json.markdown || json.text || "No explanation returned.");
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to generate explanation.");
      }
    })();
    return () => { alive = false; };
  }, [question, datasetId, JSON.stringify(meta || {})]);

  return (
    <div className={className ?? ""}>
      <div className="text-sm font-semibold mb-2">Explainability (LLM)</div>
      {err ? <div className="text-sm text-red-600">{err}</div> : <Markdown>{text}</Markdown>}
    </div>
  );
}
