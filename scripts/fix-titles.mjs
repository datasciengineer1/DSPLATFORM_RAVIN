import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "app");
const now = new Date();
const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0,14);

// walk recursively
function* walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) yield p;
  }
}

const NEEDLES = [
  "Distribution of COGS",
  "Distribution of Revenue",
  "Counts by Category",
  "Share of City",
  "COGS vs Revenue",
  "Trend of COGS by Date",
];

let touched = 0;

for (const file of walk(TARGET_DIR)) {
  const src = fs.readFileSync(file, "utf8");
  if (!NEEDLES.some(n => src.includes(n))) continue;

  // detect variable names used in THIS file
  const has = (s) => src.includes(s);
  const N0 = has("numCols") ? "numCols[0]"
          : has("numericColumns") ? "numericColumns?.[0]"
          : '"COGS"';
  const N1 = has("numCols") ? "numCols[1]"
          : has("numericColumns") ? "numericColumns?.[1]"
          : '"Revenue"';
  const C0 = has("catCols") ? "catCols[0]"
          : has("categoricalColumns") ? "categoricalColumns?.[0]"
          : '"Category"';
  const C1 = has("catCols") ? "catCols[1]"
          : has("categoricalColumns") ? "categoricalColumns?.[1]"
          : '"City"';
  const XF = has("xField") ? "xField" : N0;
  const YF = has("yField") ? "yField" : N1;
  const TG = has("timeGrain") ? "timeGrain" : "null";

  let out = src;

  // --- Heading text nodes ---
  out = out
    .replace(
      /<h([123])([^>]*)>\s*Distribution\s+of\s+COGS\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">Distribution of {${N0} ?? "COGS"}</h3>`
    )
    .replace(
      /<h([123])([^>]*)>\s*Distribution\s+of\s+Revenue\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">Distribution of {${N1} ?? "Revenue"}</h3>`
    )
    .replace(
      /<h([123])([^>]*)>\s*Counts\s+by\s+Category\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">Counts by {${C0} ?? "Category"}</h3>`
    )
    .replace(
      /<h([123])([^>]*)>\s*Share\s+of\s+City\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">Share of {${C1} ?? "City"}</h3>`
    )
    .replace(
      /<h([123])([^>]*)>\s*COGS\s+vs\s+Revenue\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">{(${XF} ?? "COGS")} vs {(${YF} ?? "Revenue")}</h3>`
    )
    .replace(
      /<h([123])([^>]*)>\s*Trend\s+of\s+COGS\s+by\s+Date\s*<\/h\1>/gi,
      (_, __, attrs) =>
        `<h3 className="text-sm font-semibold">Trend of {(${YF} ?? "COGS")} by {(${XF} ?? "Date")}{(${TG}) ? (" (" + ${TG} + ")") : ""}</h3>`
    );

  // --- title="..." props on wrappers/cards ---
  out = out
    .replace(
      /title\s*=\s*"(?:\s*)Distribution\s+of\s+COGS(?:\s*)"/gi,
      () => `title={"Distribution of " + ( ${N0} ?? "COGS" )}`
    )
    .replace(
      /title\s*=\s*"(?:\s*)Distribution\s+of\s+Revenue(?:\s*)"/gi,
      () => `title={"Distribution of " + ( ${N1} ?? "Revenue" )}`
    )
    .replace(
      /title\s*=\s*"(?:\s*)Counts\s+by\s+Category(?:\s*)"/gi,
      () => `title={"Counts by " + ( ${C0} ?? "Category" )}`
    )
    .replace(
      /title\s*=\s*"(?:\s*)Share\s+of\s+City(?:\s*)"/gi,
      () => `title={"Share of " + ( ${C1} ?? "City" )}`
    )
    .replace(
      /title\s*=\s*"(?:\s*)COGS\s+vs\s+Revenue(?:\s*)"/gi,
      () => `title={( ${XF} ?? "COGS") + " vs " + ( ${YF} ?? "Revenue" )}`
    )
    .replace(
      /title\s*=\s*"(?:\s*)Trend\s+of\s+COGS\s+by\s+Date(?:\s*)"/gi,
      () =>
        `title={"Trend of " + ( ${YF} ?? "COGS") + " by " + ( ${XF} ?? "Date") + ( (${TG}) ? (" (" + ${TG} + ")") : "" )}`
    );

  if (out !== src) {
    // backup then write
    fs.copyFileSync(file, `${file}.bak.${stamp}`);
    fs.writeFileSync(file, out, "utf8");
    console.log("✔ updated:", file);
    touched++;
  }
}

console.log(`\n${touched ? "✅" : "ℹ️"} ${touched} file(s) updated.`);
