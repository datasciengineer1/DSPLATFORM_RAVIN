"use client";
import React from "react";

export default function VoiceLoop({
  enabled, speakText, onFinal
}: {
  enabled: boolean;
  speakText?: string;
  onFinal: (text: string) => void;
}) {
  // TTS
  React.useEffect(() => {
    if (!enabled || !speakText) return;
    try {
      const u = new SpeechSynthesisUtterance(speakText);
      u.rate = 1.0; u.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }, [enabled, speakText]);

  // Continuous STT
  React.useEffect(() => {
    if (!enabled) return;
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) onFinal(last[0].transcript);
    };
    try { rec.start(); } catch {}
    return () => { try { rec.stop(); } catch {} };
  }, [enabled, onFinal]);

  return null;
}
