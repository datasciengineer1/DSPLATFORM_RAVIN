export const runtime = 'nodejs';

export async function GET() {
  const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  try {
    const ping = await fetch(`${base}/api/tags`, { method:'GET' });
    const ok = ping.ok;
    const txt = await ping.text();
    return new Response(JSON.stringify({ ok, base, tags: txt.slice(0,500) }), { status:200, headers:{'content-type':'application/json'}});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, base, error:String(e?.message||e) }), { status:200, headers:{'content-type':'application/json'}});
  }
}
