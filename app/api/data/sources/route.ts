import { NextResponse } from 'next/server';

export async function GET(){
  // Keep ids stable; UI shows name.
  return NextResponse.json([
    { id:'demo:titanic', name:'Demo Titanic' },
    { id:'demo:iris',    name:'Demo Iris' },
    { id:'demo:wine',    name:'Demo Wine' },
    { id:'demo:tips',    name:'Demo Tips' },
    { id:'demo:heart',   name:'Demo Heart' }
  ]);
}
