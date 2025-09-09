"use client";
import React from "react";

export default function ResultSkeleton({ lines=10 }:{ lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({length: lines}).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded ${i%4===0 ? "w-3/4" : "w-full"} bg-zinc-200 dark:bg-zinc-800`}
        />
      ))}
    </div>
  );
}
