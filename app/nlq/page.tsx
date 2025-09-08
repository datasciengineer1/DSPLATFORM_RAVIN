"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepNav from "@/components/ui/StepNav";
import { detectTask } from "@/utils/nlq";

export default function NLQPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // UI state
  const [q, setQ] = useState(
    "What is the sales forecast for next 2 quarters based on last 2 years of data?"
  );
  const [dataset, setDataset] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>("");

  // request guards (prevents race/double update)
  const nlqAbortRef = useRef<AbortController | null>(null);
  const nlqReqIdRef = useRef(0);

  useEffect(() => {
    const datasetFromUrl = sp.get("dataset") || sp.get("id");
    const s =
      datasetFromUrl ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("currentDatasetId")
        : null);
    setDataset(s);
  }, [sp]);

  async function onAnalyze() {
    if (analyzing) return;
    setError("");

    const ds = dataset || "demo";
    const task = detectTask(q || "");

    // cancel any in-flight request
    nlqAbortRef.current?.abort?.();
    const aborter = new AbortController();
    nlqAbortRef.current = aborter;
    const reqId = ++nlqReqIdRef.current;

    setAnalyzing(true);

    try {
      // 1) Primary path: lightweight NLQ preview
      const r1 = await fetch("/api/nlq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, datasetId: ds }),
        signal: aborter.signal,
        cache: "no-store",
      });

      if (!r1.ok) throw new Error(`NLQ HTTP ${r1.status}`);
      const json = await r1.json();

      if (nlqReqIdRef.current === reqId) {
        // Persist for the Predict step to read
        if (typeof window !== "undefined") {
          sessionStorage.setItem("nlq.sql", json?.sql ?? "");
          sessionStorage.setItem(
            "nlq.rows",
            JSON.stringify(json?.rows ?? [])
          );
          sessionStorage.setItem("nlq.question", q);
          sessionStorage.setItem("nlq.datasetId", ds);
        }
        router.push(
          `/predict?dataset=${encodeURIComponent(
            ds
          )}&task=${encodeURIComponent(task)}&q=${encodeURIComponent(q)}`
        );
      }
    } catch (_primaryErr) {
      // 2) Fallback: Ollama explain endpoint
      try {
        const r2 = await fetch("/api/explain/llm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: q,
            datasetId: ds,
            context:
              "Return business-friendly insights with drivers, caveats, and next actions.",
          }),
          signal: aborter.signal,
          cache: "no-store",
        });

        if (!r2.ok) throw new Error(`Explain HTTP ${r2.status}`);
        const ex = await r2.json();

        if (nlqReqIdRef.current === reqId) {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("nlq.answer", ex?.answer ?? "");
            sessionStorage.setItem("nlq.provider", ex?.provider ?? "ollama");
            sessionStorage.setItem("nlq.question", q);
            sessionStorage.setItem("nlq.datasetId", ds);
          }
          router.push(
            `/predict?dataset=${encodeURIComponent(
              ds
            )}&task=${encodeURIComponent(task)}&q=${encodeURIComponent(q)}`
          );
        }
      } catch (fallbackErr: any) {
        if (nlqReqIdRef.current === reqId) {
          setError(fallbackErr?.message || "Analyze failed");
        }
      }
    } finally {
      if (nlqReqIdRef.current === reqId) setAnalyzing(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="nlq" />
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 p-4">
        <div className="text-lg font-semibold mb-3">Step 4: NLQ</div>

        <textarea
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask a question about your data…"
        />

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing || !q}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-60"
          >
            {analyzing ? "Analyzing…" : "Analyze question"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1.5 rounded-lg border"
          >
            Back
          </button>
        </div>

        <div className="mt-3 text-sm text-zinc-500">
          Detected dataset:{" "}
          <span className="font-medium">{dataset ?? "(none)"} </span>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
