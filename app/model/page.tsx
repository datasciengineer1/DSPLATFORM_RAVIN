"use client";
import React, { useState } from "react";
import Link from "next/link";
import { LeftPanel, RightPanel, PanelCard } from "../components/SidePanels";

export default function ModelPage(){
  const datasetName = typeof window !== "undefined" ? sessionStorage.getItem("currentDatasetName") : null;

  const [mode, setMode] = useState<"automl"|"manual">("automl");
  const [model, setModel] = useState("LinearRegression");
  const [target, setTarget] = useState("Sales");

  const explainList = [
    mode === "automl" ? "AutoML will select the best model for the task." : `Manual override: ${model}`,
    `Target variable: ${target}`
  ];
  const recommended = ["Proceed to Predict to train/validate."];

  return (
    <main className="container mx-auto px-4 py-4">
      <div className="grid grid-cols-12 gap-4">
        <LeftPanel explainList={explainList} recommended={recommended} />
        <div className="col-span-12 xl:col-span-6 space-y-4">
          <PanelCard title="Step 5: Model">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={mode==="automl"} onChange={()=>setMode("automl")} />
                  <span>AutoML (default)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={mode==="manual"} onChange={()=>setMode("manual")} />
                  <span>Manual</span>
                </label>
              </div>
              {mode==="manual" && (
                <div className="flex gap-2">
                  <select className="border rounded-lg px-3 py-2" value={model} onChange={e=>setModel(e.target.value)}>
                    <option>LinearRegression</option>
                    <option>LogisticRegression</option>
                    <option>RandomForest</option>
                  </select>
                  <input className="border rounded-lg px-3 py-2" value={target} onChange={e=>setTarget(e.target.value)} />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Link href="/nlq" className="px-3 py-1.5 rounded-lg border">Back</Link>
                <Link href="/predict" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Next</Link>
              </div>
            </div>
          </PanelCard>
        </div>
        <RightPanel datasetName={datasetName} />
      </div>
    </main>
  );
}
