export const runtime = 'nodejs';
export async function POST(req: Request) {
  const body = await req.json();
  return Response.json({ ok: true, applied: body });
}
