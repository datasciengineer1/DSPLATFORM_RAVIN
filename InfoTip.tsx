"use client";
import React from "react";

export default function InfoTip({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  // Simple, accessible tooltip: native title + sr-only long text
  return (
    <span className="inline-flex items-center ml-1" title={title} aria-label={title}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-white text-[10px]">
        i
      </span>
      {children ? <span className="sr-only">{children}</span> : null}
    </span>
  );
}
