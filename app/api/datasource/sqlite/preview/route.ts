export const runtime = 'nodejs';
import Database from "better-sqlite3";
import path from "node:path";

export async function POST(req: Request) {
  const { dbPath = process.env.SQLITE_PATH, table, limit = 15 } = await req.json();
  if (!dbPath) return new Response(JSON.stringify({ error: "SQLITE_PATH not set" }), { status: 500 });

  const safeTable = String(table||"").replace(/[^\w.]/g, "");
  if (!safeTable) return new Response(JSON.stringify({ error: "table is required" }), { status: 400 });

  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare(`SELECT * FROM ${safeTable} LIMIT ?`).all(Number(limit)||15);
  db.close();

  return new Response(JSON.stringify({ id:`sqlite:${safeTable}`, name:`SQLite:${path.basename(dbPath)}:${safeTable}`, preview: rows }), {
    status:200, headers:{ "content-type":"application/json" }
  });
}
