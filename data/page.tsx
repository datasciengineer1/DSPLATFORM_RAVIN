"use client";
import StepNav from "@/components/ui/StepNav";

export default function DataPage() {
  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="data" />
      <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-lg font-semibold mb-2">Step 1: Data</div>
        <div className="text-sm text-zinc-500">Connect or upload your dataset here.</div>
      </div>
    </main>
  );
}
