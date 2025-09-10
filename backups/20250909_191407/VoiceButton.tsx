"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  /** Called once with the final cleaned transcript. Optional. */
  onFinal?: (text: string) => void;
  className?: string;
  /** "auto-detect" (default) or a BCP-47 locale like "en-US", "hi-IN" */
  autoLanguage?: string;
  /** Fallback selector to locate your NLQ textarea (used if onFinal is not provided) */
  targetSelector?: string;
  /** Auto-stop after this much silence (ms) */
  maxPauseMs?: number;
};

// collapse repeated words ("what what") and bigrams ("what are what are")
function collapseRepeats(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = out[out.length - 1];
    if (prev && w.toLowerCase() === prev.toLowerCase()) continue;
    const next = words[i + 1];
    if (next) {
      const bigram = `${w} ${next}`.toLowerCase();
      const prevBigram =
        out.length >= 2
          ? `${out[out.length - 2]} ${out[out.length - 1]}`.toLowerCase()
          : "";
      if (bigram === prevBigram) {
        i++;
        continue;
      }
    }
    out.push(w);
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

function cleanTranscript(raw: string) {
  let s = collapseRepeats(raw);
  s = s.replace(/\b(uh|um|like|you know)\b/gi, " ");
  s = s.replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  if (/\b(what|how|why|does|is|are|can|should|will)\b/i.test(s) && !/[?.!]$/.test(s)) s += "?";
  return s;
}

export default function VoiceButton({
  onFinal,
  className = "",
  autoLanguage = "auto-detect",
  targetSelector,
  maxPauseMs = 1800,
}: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<any>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef<string>("");   // accumulate only FINAL chunks
  const interimRef = useRef<string>(""); // last interim chunk

  const deliver = (t: string) => {
    const cleaned = cleanTranscript(t);
    if (!cleaned) return;

    if (typeof onFinal === "function") {
      try { onFinal(cleaned); } catch {}
      return;
    }

    // Fallback: populate a textarea on the page so React sees the change
    const sel =
      targetSelector ||
      'textarea[data-nlq-input="1"], #nlq, textarea[name="nlq"], textarea';
    const el = document.querySelector(sel) as HTMLTextAreaElement | null;
    if (el) {
      const proto = (window as any).HTMLTextAreaElement?.prototype;
      const setter = proto && Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, cleaned); else el.value = cleaned;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
  };

  const resetSilence = (rec: any) => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => { try { rec.stop(); } catch {} }, maxPauseMs);
  };

  const start = () => {
    setError(null);
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setError("Speech recognition not supported in this browser."); return; }

    const rec = new SR();
    recogRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    if (autoLanguage && autoLanguage !== "auto-detect") rec.lang = autoLanguage;

    finalRef.current = "";
    interimRef.current = "";

    rec.onstart = () => { setListening(true); resetSilence(rec); };
    rec.onerror = (e: any) => { setError(e?.error || "mic error"); setListening(false); };
    rec.onend = () => {
      setListening(false);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      const combined = `${finalRef.current} ${interimRef.current}`.trim();
      if (combined) deliver(combined);
    };
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const txt = r[0]?.transcript || "";
        if (!txt) continue;
        if (r.isFinal) {
          finalRef.current = `${finalRef.current} ${txt}`.replace(/\s+/g, " ").trim();
          interimRef.current = "";
        } else {
          interimRef.current = txt;
        }
      }
      resetSilence(rec);
    };

    try { rec.start(); } catch (e: any) { setError(String(e?.message || e)); setListening(false); }
  };

  const stop = () => { const r = recogRef.current; if (r) try { r.stop(); } catch {} };

  useEffect(() => () => { if (silenceTimer.current) clearTimeout(silenceTimer.current); }, []);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        className={`px-3 py-1 rounded border ${listening ? "border-amber-400 text-amber-300" : "border-zinc-600 text-zinc-200"} hover:bg-zinc-800`}
        aria-pressed={listening}
      >
        {listening ? "Listening…" : "Voice"}
      </button>
      {error && <span className="text-xs text-amber-400">{error}</span>}
    </div>
  );
}
