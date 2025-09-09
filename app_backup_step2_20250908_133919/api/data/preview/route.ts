export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import fsSync from "fs";
import path from "path";

function coerceId(x: any) {
  if (x == null) return null;
  const s = String(x).trim();
  // allow numeric ids like "1756939249232"
  return s.length ? s : null;
}

function normalizeRows(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  // common shapes
  const rows = raw.rows ?? raw.preview ?? raw.data ?? raw.records;
  if (Array.isArray(rows)) return rows;

  // object-of-rows
  if (typeof raw === "object") {
    const vals = Object.values(raw);
    if (vals.length && Array.isArray(vals[0])) return vals[0] as any[];
  }
  return [];
}

async function readDatasetFile(id: string) {
  const file = path.join(process.cwd(), "data", "datasets", `${id}.json`);
  if (!fsSync.existsSync(file)) return null;
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt);
}

// If rows are arrays and columns provided, map to objects
function rowsToObjects(rows: any[], columns?: string[]) {
  if (!rows.length) return rows;
  if (!Array.isArray(rows[0])) return rows;
  const cols = columns && columns.length ? columns : rows[0].map((_: any, i: number) => `c${i}`);
  return rows.map((arr: any[]) => {
    const o: any = {};
    for (let i = 0; i < cols.length && i < arr.length; i++) o[cols[i]] = arr[i];
    return o;
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = coerceId(body?.name ?? body?.datasetId ?? body?.id) ?? "demo";
    const limit = Math.max(1, Math.min(2000, Number(body?.limit ?? 200)));

    const ds = await readDatasetFile(id);
    if (!ds) {
      // Return 200 with empty rows and an error message (no 400 → no UI snap-back)
      return NextResponse.json({ rows: [], columns: [], error: `dataset ${id} not found` });
    }

    const columns: string[] =
      Array.isArray(ds?.columns) ? ds.columns :
      Array.isArray(ds?.schema?.fields) ? ds.schema.fields.map((f: any) => f.name) :
      undefined;

    let rows = normalizeRows(ds).slice(0, limit);
    rows = rowsToObjects(rows, columns);

    return NextResponse.json({ rows, columns: columns ?? (rows[0] ? Object.keys(rows[0]) : []) });
  } catch (e: any) {
    // Fail SAFE
    return NextResponse.json({ rows: [], columns: [], error: e?.message ?? "preview failed" });
  }
}
