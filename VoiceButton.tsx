"use client";
import React from "react";

type Props = {
  lang?: string;                 // e.g., "en-US", "hi-IN"
  onResult: (text: string) => void;
  interim?: boolean;             // show interim results (default true)
  continuous?: boolean;          // default false
  className?: string;
};

export default function VoiceButton({
  lang,
  onResult,
  interim = true,
  continuous = false,
  className = "",
}: Props) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recogRef = React.useRef<any>(null);

  React.useEffect(() => {
    // Detect support (Chrome/Edge have webkitSpeechRecognition)
    if (typeof window === "undefined") return;
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = continuous;
      r.interimResults = interim;
      r.lang = lang || "en-US";
      recogRef.current = r;
      setSupported(true);
    } else {
      setSupported(false);
    }
    return () => {
      try { recogRef.current?.stop?.(); } catch {}
    };
  }, [lang, interim, continuous]);

  const start = React.useCallback(() => {
    const r = recogRef.current;
    if (!r) return;
    let finalText = "";
    r.lang = lang || "en-US";
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const t = e.results[i][0]?.transcript || "";
        if (e.results[i].isFinal) finalText += t;
      }
      if (finalText.trim().length) onResult(finalText.trim());
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }, [lang, onResult]);

  const stop = React.useCallback(() => {
    try { recogRef.current?.stop?.(); } finally { setListening(false); }
  }, []);

  const toggle = () => (listening ? stop() : start());

  const tip = supported
    ? (listening ? "Listening… click to stop" : "Use your mic to fill the question")
    : "Voice dictation needs Chrome/Edge (Web Speech API).";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      title={tip}
      className={
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm " +
        (supported ? "hover:bg-zinc-50 dark:hover:bg-zinc-900/50 " : "opacity-60 cursor-not-allowed ") +
        className
      }
    >
      <span aria-hidden>🎙️</span>
      <span>{listening ? "Stop" : "Voice"}</span>
      {listening && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden />}
    </button>
  );
}
