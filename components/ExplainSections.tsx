"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type S = {
  what?: string; why?: string; how?: string[];
  risks?: string[]; assumptions?: string[];
  mitigation?: Array<{action:string; mechanism?:string; expected_direction?:string; effort?:string; timeframe?:string; risk?:string}>;
  next_steps?: Array<{step:string; owner?:string; effort?:string; timeframe?:string}>;
};

export default function ExplainSections({ structured, markdown, narrative }:{ structured?: S; markdown?: string; narrative?: string }){
  const s = structured||{};
  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-semibold mb-1">What it means</h4>
        <div className="text-sm text-zinc-300">
          {s.what ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.what}</ReactMarkdown> : (markdown || "—")}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-1">Why</h4>
        <div className="text-sm text-zinc-300">
          {s.why ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.why}</ReactMarkdown> : "—"}
        </div>
      </section>

      {s.how?.length ? (
        <section>
          <h4 className="text-sm font-semibold mb-1">How to analyze</h4>
          <ul className="text-sm list-disc ml-5 space-y-1">{s.how.map((t,i)=><li key={i}>{t}</li>)}</ul>
        </section>
      ): null}

      {s.mitigation?.length ? (
        <section>
          <h4 className="text-sm font-semibold mb-1">Strategies</h4>
          <ul className="text-sm list-disc ml-5 space-y-1">
            {s.mitigation.map((m,i)=>(
              <li key={i}>
                <b>{m.action}</b>{m.mechanism?`: ${m.mechanism}`:""}
                {m.expected_direction?` • expected: ${m.expected_direction}`:""}
                {m.effort?` • effort: ${m.effort}`:""}{m.timeframe?` • ${m.timeframe}`:""}
                {m.risk?` • risk: ${m.risk}`:""}
              </li>
            ))}
          </ul>
        </section>
      ): null}

      {(s.risks?.length||s.assumptions?.length) ? (
        <section>
          <h4 className="text-sm font-semibold mb-1">Assumptions & limits</h4>
          <ul className="text-sm list-disc ml-5 space-y-1">
            {(s.risks||[]).map((t,i)=><li key={`r-${i}`}>{t}</li>)}
            {(s.assumptions||[]).map((t,i)=><li key={`a-${i}`}>{t}</li>)}
          </ul>
        </section>
      ): null}

      {s.next_steps?.length ? (
        <section>
          <h4 className="text-sm font-semibold mb-1">Next best steps</h4>
          <ol className="text-sm list-decimal ml-5 space-y-1">
            {s.next_steps.map((n,i)=>(
              <li key={i}>
                {n.step}
                {n.owner?` • owner: ${n.owner}`:""}
                {n.effort?` • effort: ${n.effort}`:""}
                {n.timeframe?` • ${n.timeframe}`:""}
              </li>
            ))}
          </ol>
        </section>
      ): null}
    
      {narrative ? (
        <section>
          <h4 className="text-sm font-semibold mb-1">Detailed explanation</h4>
          <div className="prose prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
          </div>
        </section>
      ) : null}
    </div>
  );
}
