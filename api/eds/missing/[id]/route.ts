export const runtime = 'nodejs';
import * as fs from "fs/promises";
import path from "path";
const DATA_DIR = path.join(process.cwd(), "data", "datasets");

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(String(params.id || ""));
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    const d = JSON.parse(raw);
    return new Response(JSON.stringify({ datasetId: d.id, top: d.missing?.top ?? [], lastUpdated: Date.now() }), {
      status: 200, headers: { "content-type": "application/json", "cache-control":"no-store" }
    });
  } catch {
    return new Response(JSON.stringify({ datasetId: id, top: [] }), { status: 404, headers: { "content-type":"application/json" }});
  }
}
