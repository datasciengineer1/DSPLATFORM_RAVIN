import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const body = await req.json(); // { docs: [{id,text,meta}] }
  const r = await fetch('http://127.0.0.1:8009/build-index', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  return NextResponse.json(j, { status: r.status });
}
