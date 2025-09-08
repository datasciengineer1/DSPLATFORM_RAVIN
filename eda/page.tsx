"use client";
import StepNav from "@/components/ui/StepNav";

// Try to load your real compact EDA panel; fall back gracefully if missing
let RealEDA: any = null;
try { RealEDA = require("@/components/EDACompact").default; } catch {}

export default function EDAPage() {
  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="eda" />
      <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-lg font-semibold mb-2">Step 2: EDA</div>
        {RealEDA ? (
          <RealEDA />
        ) : (
          <div className="text-sm text-zinc-500">
            EDA loads here. Replace this component with your full EDA UI when ready.
          </div>
        )}
      </div>
    </main>
  );
}
