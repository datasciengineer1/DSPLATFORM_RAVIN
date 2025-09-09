"use client";
import React from "react";
export function Chip({ children }:{ children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-700">
      {children}
    </span>
  );
}
