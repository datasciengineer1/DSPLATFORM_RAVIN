import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, any>;

// Make sure this matches what your EDS routes read from:
const DATA_DIR = path.join(process.cwd(), "data", "datasets");
const datasetPath = (id: string) => path.join(DATA_DIR, `${id}.json`);

// Turn "1,234.56" -> 1234.56; keep strings/dates as-is; empty -> null
function coerceRows(rows: Row[]): Row[] {
  return rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === "" || v == null) { out[k] = null; continue; }
      const raw = String(v).trim();
      // numeric pattern with optional commas/decimal
      const isNumLike = /^\s*-?\d[\d,]*(\.\d+)?\s*$/.test(raw);
      if (isNumLike) {
        const num = Number(raw.replace(/,/g, ""));
        if (!Number.isNaN(num)) { out[k] = num; continue; }
      }
      out[k] = v;
    }
    return out;
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // parse CSV
    const buf = Buffer.from(await file.arrayBuffer());
    const raw: Row[] = parse(buf, { columns: true, skip_empty_lines: true, bom: true });
    const rows = coerceRows(raw);

    // persist dataset
    const id = String(Date.now());
    const name = (file as any).name || "upload.csv";
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(datasetPath(id), JSON.stringify({ id, name, rows }, null, 2), "utf8");

    return NextResponse.json({ id, name });
  } catch (err: any) {
    console.error("CSV upload failed:", err);
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}
