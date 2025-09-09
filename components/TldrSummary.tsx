"use client";
import React from "react";

function splitSections(md: string) {
  const sections: Record<string, string> = {};
  const lines = (md || "").split(/\r?\n/);
  let current = "";
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) sections[current] = buf.join("\n").trim();
      current = m[1].toLowerCase();
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) sections[current] = buf.join("\n").trim();
  return sections;
}

function firstSentences(text: string, n = 2) {
  const clean = (text || "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ");
}

export default function TldrSummary({
  markdown,
  className = "",
}: {
  markdown: string;
  className?: string;
}) {
  const sections = React.useMemo(() => splitSections(markdown || ""), [markdown]);
  const what = sections["what it means"] || sections["what"] || "";
  const why = sections["why"] || "";
  const how = sections["how to analyze"] || sections["how"] || "";

  if (!(what || why || how)) return null;

  const cards = [
    { title: "What", body: firstSentences(what, 2) },
    { title: "Why", body: firstSentences(why, 2) },
    { title: "How", body: firstSentences(how, 2) },
  ];

  return (
    <div className={"mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 " + className}>
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2"
        >
          <div className="text-xs font-semibold mb-1">{c.title}</div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {c.body || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
