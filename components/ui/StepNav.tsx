"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * StepNav — top nav chips for quick navigation.
 * - Preserves ?dataset=<id> or ?id=<id> (fallback to sessionStorage "currentDatasetId")
 * - Highlights the active step
 */
export default function StepNav({ active }: { active: "data"|"eda"|"eng"|"nlq"|"model"|"predict" }) {
  const sp = useSearchParams();
  const spId = sp.get("dataset") || sp.get("id");
  const [dataset, setDataset] = useState<string | null>(null);

  useEffect(() => {
    const s = spId || (typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetId") : null);
    setDataset(s || null);
  }, [spId]);

  const steps = useMemo(() => [
    { key: "data",    label: "Data",      href: "/data" },
    { key: "eda",     label: "EDA",       href: "/eda" },
    { key: "eng",     label: "Eng",       href: "/engineering" },
    { key: "nlq",     label: "NLQ",       href: "/nlq" },
    { key: "model",   label: "Model",     href: "/model" },
    { key: "predict", label: "Predict",   href: "/predict" },
  ], []);

  const qs = dataset ? `?dataset=${encodeURIComponent(dataset)}` : "";

  return (
    <div className="flex flex-wrap gap-2 py-3">
      {steps.map((s) => (
        <Link
          key={s.key}
          href={`${s.href}${qs}`}
          className={[
            "px-3 py-1.5 rounded-full border text-sm transition-colors",
            active===s.key
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          ].join(" ")}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
