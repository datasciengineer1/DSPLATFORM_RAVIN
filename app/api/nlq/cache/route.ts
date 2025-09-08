import { NextResponse } from "next/server";
import { deleteByQuestion, readCache, writeCache } from "@/lib/cache";

export async function GET(){ return NextResponse.json({ items: readCache() }); }

export async function DELETE(req:Request){
  const { nlq, all=false } = await req.json();
  if(all){ writeCache([]); return NextResponse.json({ ok:true, cleared:"all" }); }
  if(!nlq) return NextResponse.json({ ok:false, error:"Missing nlq or all=true" },{status:400});
  deleteByQuestion(nlq);
  return NextResponse.json({ ok:true, cleared:"by_nlq" });
}
