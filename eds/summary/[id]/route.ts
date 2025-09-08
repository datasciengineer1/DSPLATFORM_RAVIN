import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const p = path.join(process.cwd(), 'data', 'datasets', `${params.id}.json`);
    if (!fs.existsSync(p)) {
      return new NextResponse(`Dataset "${params.id}" not found`, { status: 404 });
    }
    const ds = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const preview = Array.isArray(ds?.preview)
      ? ds.preview
      : Array.isArray(ds?.rows)
        ? ds.rows.slice(0, 100)
        : [];
    return NextResponse.json({ ...ds, preview });
  } catch (err: any) {
    console.error('EDS summary error:', err?.stack || err);
    return new NextResponse('Failed to get summary', { status: 500 });
  }
}
