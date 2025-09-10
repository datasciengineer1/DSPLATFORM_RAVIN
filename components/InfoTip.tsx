"use client";
import React, {useState} from "react";
export default function InfoTip({title, children}:{title:string; children:React.ReactNode}){
  const [open,setOpen]=useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button" aria-label="info"
        className="ml-2 text-xs w-5 h-5 rounded-full border border-zinc-600 hover:bg-zinc-800"
        onClick={()=>setOpen(o=>!o)}
        onMouseEnter={()=>!open && setOpen(true)}
        onMouseLeave={()=>setOpen(false)}
      >i</button>
      {open && (
        <div className="z-50 absolute right-0 mt-2 w-80 p-3 rounded-xl border border-zinc-700 bg-zinc-900 shadow-lg text-sm">
          <div className="font-semibold mb-1">{title}</div>
          <div className="text-zinc-300">{children}</div>
        </div>
      )}
    </div>
  );
}
