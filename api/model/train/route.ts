export const runtime = 'nodejs';
function rand(n:number, m:number){ return n + Math.random()*(m-n); }

export async function POST(req: Request) {
  const body = await req.json();
  const task = body.task || "regression";

  if(task === "classification"){
    const confusion = [[80,20],[15,85]];
    const roc = Array.from({length:25}, (_,i)=>({ fpr: i/24, tpr: Math.pow(i/24, 0.7) }));
    const auc = 0.89;
    const metrics = { accuracy: 0.85, precision: 0.83, recall: 0.82, f1: 0.825 };
    return Response.json({ task, metrics, confusion, roc, auc });
  } else {
    const series = Array.from({length:40}, (_,i)=>({
      name: `t${i+1}`,
      actual: 100 + i*2 + Math.sin(i/2)*8,
      pred:   98 + i*2 + Math.sin(i/2)*8 + rand(-2,2),
    }));
    const metrics = { rmse: 5.42, mae: 4.10, r2: 0.91 };
    return Response.json({ task, metrics, series });
  }
}
