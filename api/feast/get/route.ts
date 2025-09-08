import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const body = await req.json(); // { entity_id }
  const r = await fetch('http://127.0.0.1:8010/get-features', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  return NextResponse.json(j, { status: r.status });
}
