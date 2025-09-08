"use client";
import StepNav from "@/components/ui/StepNav";

export default function EngPage() {
  return (
    <main className="container mx-auto px-4 py-4">
      <StepNav active="engineering" />
      <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-lg font-semibold mb-2">Step 3: Engineering</div>
        <div className="text-sm text-zinc-500">
          Feature engineering / transformations / pipeline settings go here.
        </div>
      </div>
    </main>
  );
}
