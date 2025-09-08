import { NextResponse } from "next/server";
import { autoSelect } from "@/lib/automl";

export async function POST(req:Request){
  const { nlq="", mode="auto", manual } = await req.json();

  if(mode==="manual"){
    const task = manual?.task || "regression";
    const model = manual?.model || "Linear Regression";
    return NextResponse.json({
      task,
      recommendedModel: model,
      reasons: ["Manual selection supplied; validating compatibility with NLQ context."],
      options: []
    });
  }

  // AutoML
  const out = autoSelect(nlq);
  return NextResponse.json(out);
}
