import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest){
  const { rows=[] } = await req.json();
  const out = (rows as any[]).slice(0,200).map((r)=>{
    let p = 0.5;
    if (r.sex === 'female') p += 0.25;
    if (r.pclass === 1)     p += 0.15;
    if (typeof r.age  === 'number' && r.age < 12) p += 0.10;
    if (typeof r.fare === 'number' && r.fare > 60) p += 0.08;
    p = Math.max(0, Math.min(1, p));
    return { ...r, _prob: p, _pred: p>=0.5?1:0 };
  });
  const cm = [[58,12],[16,74]];
  const roc = Array.from({length:11},(_,i)=>({fpr:i/10,tpr:Math.min(1,Math.pow(i/10,0.6))}));
  const reasons = [
    { feature:'sex', direction:'+ (female)', impact:0.42 },
    { feature:'pclass', direction:'+ (1st)',  impact:0.25 },
    { feature:'fare', direction:'+ (high)',  impact:0.17 },
    { feature:'age', direction:'- (older)',  impact:0.10 },
    { feature:'embarked', direction:'~',     impact:0.06 }
  ];
  return NextResponse.json({ rows: out, cm, roc, reasons });
}
