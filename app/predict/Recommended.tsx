"use client";
export default function Recommended({
  task, target, onPick
}:{ task?: "forecast"|"regression"|"classification", target?:string, onPick:(q:string)=>void }){

  const t = target || "value";
  const items =
    task==="forecast"
      ? [
          `Top 3 cities driving ${t} recently.`,
          `Is there seasonality in ${t}?`,
          `What changed last month that impacted ${t}?`,
        ]
    : task==="classification"
      ? [
          `Which features most increase odds of ${t}?`,
          `Optimize threshold for best F1 on ${t}.`
        ]
      : [
          `Top 5 drivers of ${t}.`,
          `Partial dependence of the most important feature on ${t}.`,
        ];

  return (
    <div className="space-y-2">
      {items.map((q,i)=>(
        <button key={i}
          onClick={()=>onPick(q)}
          className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
          {q}
        </button>
      ))}
    </div>
  );
}
