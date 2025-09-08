export const runtime = 'nodejs';
function hash(s: string){ let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return Math.abs(h); }
function seeded(seed:number){ let t=(seed%2147483647)||1; return ()=> (t=(t*48271)%2147483647)/2147483647; }

export async function GET(_req: Request, { params }: { params: { id: string[] } }) {
  const raw = Array.isArray(params.id) ? params.id.join("/") : String(params.id||"");
  const rnd = seeded(hash(decodeURIComponent(raw||"demo")));
  const cols = ["Discount","ShipMode","PostalCode","CustomerSegment","ProductWeight","Notes","Region","Color"];
  const top = cols.slice(0,6).map(c=>({ column:c, count: Math.round(50 + rnd()*400) }));
  return new Response(JSON.stringify({ datasetId: decodeURIComponent(raw||"demo"), top }), { status:200, headers:{ "content-type":"application/json" }});
}
