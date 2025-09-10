// components/VoiceButton.tsx
"use client";
import React, {useEffect, useRef, useState} from "react";

export default function VoiceButton(
  { onFinal, autoLanguage="auto-detect", disabled=false }:
  { onFinal:(t:string)=>void; autoLanguage?:string; disabled?:boolean }
){
  const [listening,setListening]=useState(false);
  const recRef = useRef<any>(null);
  const bufRef = useRef<string>("");
  const timerRef = useRef<any>(null);
  const lastRef = useRef<string>("");

  useEffect(()=>{
    // Browser guard
    const SR:any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if(!SR) return;
    const r = new SR();
    r.interimResults = true;
    r.continuous = true;
    r.lang = autoLanguage==="auto-detect" ? undefined : autoLanguage;
    r.onresult = (ev:any)=>{
      let interim = "";
      for(let i=ev.resultIndex;i<ev.results.length;i++){
        const res = ev.results[i];
        const t = res[0].transcript;
        if(res.isFinal){
          bufRef.current += (t.endsWith(".")? t : t+" ");
        } else {
          interim += t + " ";
        }
      }
      // simple dedupe of repeating prefixes
      const clean = (bufRef.current + " " + interim).replace(/\b(\w+)( \1\b)+/gi,"$1");
      lastRef.current = clean.trim();

      if(timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(()=>{
        const finalT = lastRef.current.trim();
        if(finalT){
          onFinal(finalT);
          bufRef.current = "";
          lastRef.current = "";
        }
        try{ r.stop(); }catch{}
        setListening(false);
      }, 2000); // 2s silence
    };
    r.onerror = ()=>{ setListening(false); };
    recRef.current = r;
    return ()=>{ try{ r.stop(); }catch{} };
  },[autoLanguage, onFinal]);

  const toggle = ()=>{
    if(disabled) return;
    const r = recRef.current;
    if(!r) return;
    if(listening){ try{ r.stop(); }catch{} setListening(false); return; }
    bufRef.current = ""; lastRef.current = "";
    try{ r.start(); setListening(true); }catch{}
  };

  return (
    <button type="button" onClick={toggle} disabled={disabled}
      className={`px-3 py-1 rounded-md border ${listening?'bg-blue-600 text-white border-blue-500':'bg-zinc-900 border-zinc-700'}`}>
      {listening? "Listening…" : "Voice"}
    </button>
  );
}
