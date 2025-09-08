"use client";
import React, { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import ChartCard from "@/app/components/ui/ChartCard";
import { makeChartTitle } from "@/app/utils/chartTitle";

type Props = {
  data: any[];             // raw rows
  xKey: string;            // numeric field to histogram
  bins?: number;           // default auto (sqrt rule)
  height?: number;         // default 260
  datasetName?: string;
  title?: string;          // optional override
};

export default function HistogramChart({
  data, xKey, bins, height = 260, datasetName, title,
}: Props) {
  const histData = useMemo(() => {
    const values = (data || [])
      .map((r) => Number(r?.[xKey]))
      .filter((v) => Number.isFinite(v));
    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const k = bins ?? Math.min(40, Math.max(5, Math.round(Math.sqrt(values.length))));
    const span = max - min || 1;
    const step = span / k;

    const arr = Array.from({ length: k }, (_, i) => {
      const x0 = min + i * step;
      const x1 = min + (i + 1) * step;
      return { x0, x1, label: `${x0.toFixed(0)}–${x1.toFixed(0)}`, count: 0 };
    });

    for (const v of values) {
      const idx = Math.min(k - 1, Math.max(0, Math.floor((v - min) / step)));
      arr[idx].count++;
    }
    return arr;
  }, [data, xKey, bins]);

  const computedTitle =
    title ??
    makeChartTitle({
      datasetName: datasetName ?? null,
      column: xKey,
      chartType: "histogram",
    });

  return (
    <ChartCard title={computedTitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} height={44} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
