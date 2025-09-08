"use client";
import Link from "next/link";
export default function TopNav(){
  return (
    <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-100 dark:border-zinc-800">
      <div className="container mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto">
        <Link href="/" className="px-2 py-1 rounded-lg border">Home</Link>
        <Link href="/workspace" className="px-2 py-1 rounded-lg border">EDA</Link>
        <Link href="/engineering" className="px-2 py-1 rounded-lg border">Engineering</Link>
        <Link href="/nlq" className="px-2 py-1 rounded-lg border">NLQ</Link>
        <Link href="/model" className="px-2 py-1 rounded-lg border">Model</Link>
        <Link href="/predict" className="px-2 py-1 rounded-lg border">Predict</Link>
        <span className="grow" />
        <button
          onClick={()=>{
            try { sessionStorage.clear(); } catch {}
            window.location.href = "/workspace?dataset=demo";
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
        >
          New analysis
        </button>
      </div>
    </div>
  );
}
