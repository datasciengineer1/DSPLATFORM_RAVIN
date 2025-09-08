import fs from "fs";
import path from "path";

export type Dataset = { id: string; name?: string; rows: any[] };

const DATA_DIR = path.join(process.cwd(), "data", "datasets");

export function loadDatasetSync(id: string): Dataset {
  const p = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Dataset "${id}" not found at ${p}`);
  }
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  // Accept either {rows:[...]} or direct array
  const rows = Array.isArray(parsed) ? parsed : (parsed?.rows ?? []);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Dataset "${id}" not found or empty.`);
  }
  return { id, rows };
}

export function listNumericColumns(rows: any[], sample = 200): string[] {
  if (!rows?.length) return [];
  const head = rows.slice(0, sample);
  const keys = Object.keys(head[0] ?? {});
  const numeric: string[] = [];
  for (const k of keys) {
    let good = 0, seen = 0;
    for (const r of head) {
      if (!(k in r)) continue;
      const v = r[k];
      if (v === null || v === undefined || v === "") continue;
      seen++;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g,""));
      if (!Number.isNaN(n) && Number.isFinite(n)) good++;
    }
    if (seen > 0 && good / seen >= 0.8) numeric.push(k);
  }
  return numeric;
}

export function detectDateColumn(rows: any[], preferNames = ["date","datetime","month","day","time","timestamp"]): string | null {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]);
  // 1) name hint
  for (const name of preferNames) {
    const k = keys.find(x => x.toLowerCase() === name);
    if (k) return k;
  }
  // 2) parseable dates
  const candidates: string[] = [];
  for (const k of keys) {
    let ok = 0, seen = 0;
    for (const r of rows.slice(0, 200)) {
      const v = r[k];
      if (v == null || v === "") continue;
      seen++;
      const d = new Date(v);
      if (!isNaN(d.getTime())) ok++;
    }
    if (seen > 3 && ok / seen >= 0.7) candidates.push(k);
  }
  return candidates[0] ?? null;
}

// Alias for summary route compatibility

// --- EDS async wrappers (used by /api/eds/summary) ---


// --- Unified async wrappers (single source of truth) ---
export async function getDataset(id: string) {
  // use the sync loader you already have in this file
  return loadDatasetSync(id);
}

export async function loadDataset(id: string) {
  return getDataset(id);
}
