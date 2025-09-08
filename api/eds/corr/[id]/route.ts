export const runtime = "nodejs";

import * as fs from "fs/promises";
import fsSync from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "datasets");

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(String(params.id || ""));
  try {
    const file = path.join(DATA_DIR, `${id}.json`);
    if (!fsSync.existsSync(file)) {
      return new Response(JSON.stringify({ datasetId: id, top: [] }), {
        status: 404,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    const raw = await fs.readFile(file, "utf8");
    const d = JSON.parse(raw);

    let topList: Array<{ column: string; ratio: number }> = d?.missing?.top ?? [];

    // Optional ?top=N
    const url = new URL(req.url);
    const topStr = url.searchParams.get("top");
    const top = topStr ? Math.max(1, Number(topStr) || 0) : 0;
    if (top > 0) {
      topList = [...topList].sort((a, b) => b.ratio - a.ratio).slice(0, top);
    }

    return new Response(JSON.stringify({ datasetId: d.id ?? id, top: topList, lastUpdated: Date.now() }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("EDS missing error:", err);
    return new Response(JSON.stringify({ datasetId: id, top: [] }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}
