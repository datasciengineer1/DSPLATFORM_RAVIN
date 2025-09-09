export const runtime = "nodejs";

// Simple deterministic helpers for a stable synthetic response
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seeded(seed: number) {
  let t = (seed % 2147483647) || 1;
  return () => ((t = (t * 48271) % 2147483647) / 2147483647);
}

export async function GET(req: Request, { params }: { params: { id: string[] } }) {
  const raw = Array.isArray(params.id) ? params.id.join("/") : String(params.id || "demo");
  const dsId = decodeURIComponent(raw || "demo");
  const rnd = seeded(hash(dsId));

  let pairs = [
    { x: "Revenue", y: "COGS", corr: +(0.6 + rnd() * 0.35).toFixed(2) },
    { x: "Revenue", y: "Quantity", corr: +(0.2 + rnd() * 0.5).toFixed(2) },
    { x: "COGS", y: "Quantity", corr: +(0.15 + rnd() * 0.45).toFixed(2) },
  ];

  const url = new URL(req.url);
  const top = Number(url.searchParams.get("top") || 0);
  if (top > 0) {
    pairs = [...pairs].sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)).slice(0, top);
  }

  return new Response(JSON.stringify({ datasetId: dsId, pairs, lastUpdated: Date.now() }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
