import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest){
  const { target='target', model='RandomForest' } = await req.json();
  // Mock "done" payload
  const modelId = `${model}_${Date.now()}`;
  return NextResponse.json({
    modelId,
    target,
    metrics: { accuracy:0.78, f1:0.75, roc_auc:0.84 },
    message: 'Training complete'
  });
}
