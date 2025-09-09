"use client";
import React from "react";

export default function InfoTip({ title, children }: { title: string; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center ml-1">
      <button
        type="button"
        aria-label={title}
        title={title}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-white text-[10px]"
      >
        i
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-80 right-0 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-lg">
          <div className="text-xs font-semibold mb-1">{title}</div>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{children || "No details."}</div>
        </div>
      )}
    </div>
  );
}
