'use client';
import Link from 'next/link';
export default function StepNav({active=1}:{active?:number}) {
  const steps = [
    {label:'1. Data',href:'/data'},
    {label:'2. EDA',href:'/workspace'},
    {label:'3. Engineering',href:'/engineering'},
    {label:'4. NLQ',href:'/nlq'},
    {label:'5. Model',href:'/model'},
    {label:'6. Predict/Explain',href:'/predict'},
  ];
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((s,i)=>(
          <Link key={s.label} href={s.href}
            className={'px-3 py-1.5 rounded-full border text-sm '+
              (i===active-1?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300')}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
