export const runtime = 'nodejs';
import * as fs from 'fs/promises';
import path from 'path';

export async function GET(_: Request, ctx: { params: { id: string } }) {
  try {
    const file = path.join(process.cwd(), 'data', 'datasets', `${ctx.params.id}.json`);
    const raw = await fs.readFile(file, 'utf8');
    const ds = JSON.parse(raw);
    const rows = ds.frame ?? ds.preview ?? [];
    const columns: string[] = ds.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
    return new Response(JSON.stringify({ id: ctx.params.id, columns }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
}
