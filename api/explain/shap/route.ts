import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest){
  const { modelId='mdl', row=null } = await req.json();
  // Simple, fixed feature importance demo
  const featureImportances = [
    { feature:'sex',      importance:0.42, direction:'+ female' },
    { feature:'pclass',   importance:0.25, direction:'+ 1st' },
    { feature:'fare',     importance:0.17, direction:'+ high' },
    { feature:'age',      importance:0.10, direction:'- older' },
    { feature:'embarked', importance:0.06, direction:'~' }
  ];
  // Per-row reasons (if a row is provided)
  const perRow = row ? featureImportances.map(f => ({
    feature: f.feature,
    impact: Math.max(0.02, f.importance * 0.9),
    direction: f.direction
  })) : null;

  return NextResponse.json({ modelId, featureImportances, perRow });
}
