"use client";
import React from "react";

export default function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={"animate-spin " + className}
      width={size} height={size} viewBox="0 0 24 24" role="status" aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8v4A4 4 0 0 0 8 12H4z" fill="currentColor" className="opacity-75" />
    </svg>
  );
}
