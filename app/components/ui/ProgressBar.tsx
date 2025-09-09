"use client";
import React from "react";
export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${v}%` }} />
    </div>
  );
}
