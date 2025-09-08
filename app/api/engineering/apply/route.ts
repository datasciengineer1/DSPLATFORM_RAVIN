import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { task, payload } = await req.json();

  // TODO: call your real pipeline here based on `task`
  // e.g. await impute(payload) / await createFormulas(payload) etc.

  return NextResponse.json({
    ok: true,
    task,
    message: `Applied '${task}' successfully.`,
    received: payload
  });
}
