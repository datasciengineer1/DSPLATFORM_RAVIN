"use client";
import React from "react";

export default function TabStrip({
  tabs, value, onChange, className=""
}: { tabs:string[]; value:string; onChange:(v:string)=>void; className?:string }) {
  return (
    <div className={"flex gap-1 text-sm " + className}>
      {tabs.map(t => {
        const active = t === value;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={
              "px-3 py-1.5 rounded-md border " +
              (active
                ? "bg-zinc-900 text-white border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-300"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40")
            }
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
