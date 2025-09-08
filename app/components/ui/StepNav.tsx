"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StepNav({ active }: { active: "data"|"eda"|"eng"|"nlq"|"model"|"predict" }) {
  const sp = useSearchParams();
  const spId = sp.get("dataset") || sp.get("id");
  const [dataset, setDataset] = useState<string | null>(null);

  useEffect(() => {
    const s = spId || (typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetId") : null);
    setDataset(s || null);
  }, [spId]);

  const steps = [
    { key:"data",    label:"1. Data",        href:"/data" },
    { key:"eda",     label:"2. EDA",         href:"/workspace" },
    { key:"eng",     label:"3. Engineering", href:"/engineering" },
    { key:"nlq",     label:"4. NLQ",         href:"/nlq" },
    { key:"model",   label:"5. Model",       href:"/model" },
    { key:"predict", label:"6. Predict",     href:"/predict" },
  ] as const;

  const qs = dataset ? (`?dataset=${encodeURIComponent(dataset)}`) : "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {steps.map(s => (
        <Link
          key={s.key}
          href={`${s.href}${qs}`}
          className={[
            "px-3 py-1.5 rounded-full border text-sm",
            active===s.key
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          ].join(" ")}
        >{s.label}</Link>
      ))}
    </div>
  );
}
