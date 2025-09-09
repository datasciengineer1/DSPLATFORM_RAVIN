"use client";
import React from "react";

export function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800">
      <div className="p-4 pb-0"><div className="text-lg font-semibold">{title}</div></div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function LeftPanel({ children }: { children: React.ReactNode }) {
  return <div className="col-span-12 xl:col-span-3 space-y-4">{children}</div>;
}

export function RightPanel({ children }: { children: React.ReactNode }) {
  return <div className="col-span-12 xl:col-span-3 space-y-4">{children}</div>;
}
