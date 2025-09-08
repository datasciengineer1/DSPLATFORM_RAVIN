"use client";
import React from "react";
export default function ChartCard({
  title, subtitle, rightSlot, children,
}: { title: string; subtitle?: string; rightSlot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold leading-tight">{title}</h3>
          {subtitle ? <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="ml-4">{rightSlot}</div> : null}
      </div>
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  );
}
