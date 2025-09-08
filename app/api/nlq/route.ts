export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import fsSync from "fs";
import path from "path";

async function readPreviewFromFile(id: string, limit = 25) {
  const file = path.join(process.cwd(), "data", "datasets", `${id}.json`);
  if (!fsSync.existsSync(file)) return [];
  try {
    const raw = await fs.readFile(file, "utf8");
    const j = JSON.parse(raw);

    let rows: any =
      j?.preview ??
      j?.rows ??
      j?.data ??
      j?.records ??
      (Array.isArray(j) ? j : null);

    if (!rows && j && typeof j === "object") rows = Object.values(j);
    if (Array.isArray(rows)) return rows.slice(0, limit);
    return [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { query, datasetId } = body || {};
  const id = String(datasetId || "demo");

  const { origin } = new URL(req.url);

  // Try internal preview route first (absolute URL)
  let rows: any[] = [];
  try {
    const res = await fetch(`${origin}/api/data/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: id, limit: 25 }),
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      rows = Array.isArray(j?.rows) ? j.rows : [];
    }
  } catch {
    // ignore; fall back to file
  }

  if (!rows.length) rows = await readPreviewFromFile(id, 25);

  const sql =
    (query ? `-- NLQ (stub)\n-- ${query}\n` : "") +
    `SELECT * FROM ${id} LIMIT 25`;

  return NextResponse.json({ sql, rows });
}
