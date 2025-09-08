import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, model, temperature = 0.2 } = await req.json();
  const base = process.env.OLLAMA_URL || 'http://localhost:11434';
  const usedModel = model || process.env.OLLAMA_CHAT_MODEL || 'llama3.1';

  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: usedModel, messages, stream: false, options: { temperature } })
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: r.status });
  const j = await r.json();
  const text = j?.message?.content ?? '';
  return NextResponse.json({ text, model: usedModel, provider: 'ollama' });
}
