"use client";
import React from "react";

type Opt = { code:string; label:string };
const LANGS: Opt[] = [
  { code:"auto", label:"Auto-detect" },
  { code:"en",   label:"English" },
  { code:"hi",   label:"हिन्दी (Hindi)" },
  { code:"es",   label:"Español" },
  { code:"fr",   label:"Français" },
  { code:"de",   label:"Deutsch" },
  { code:"zh",   label:"中文" },
  { code:"ja",   label:"日本語" }
];

export default function LanguageSelect({
  value, onChange
}: { value:string; onChange:(v:string)=>void }) {
  return (
    <select
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 w-full"
    >
      {LANGS.map(o=>(
        <option key={o.code} value={o.code}>{o.label}</option>
      ))}
    </select>
  );
}
