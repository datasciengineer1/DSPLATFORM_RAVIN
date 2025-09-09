"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

export type SeriesItem = { name: string; x: (number|string)[]; y: number[] };

type Props = {
  series: SeriesItem[];
  height?: number;
  title?: string;
};

export default function BigLine({ series, height = 360, title }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chartRef.current?.resize());
      ro.observe(ref.current);
    }
    const s = (series || []).map((it) => ({
      name: it.name,
      type: "line",
      showSymbol: false,
      large: true,              // optimized for lots of points
      sampling: "lttb",         // down-sample visually (keeps shape)
      lineStyle: { width: 1 },
      emphasis: { focus: "series" },
      data: (it.x || []).map((xi, i) => [xi, it.y?.[i] ?? null])
    }));

    const option: echarts.EChartsOption = {
      animation: false,
      title: title ? { text: title } : undefined,
      grid: { left: 40, right: 18, top: title ? 36 : 12, bottom: 28 },
      tooltip: { trigger: "axis" },
      legend: s.length > 1 ? { type: "scroll" } : undefined,
      xAxis: { type: "category", boundaryGap: false },
      yAxis: { type: "value", scale: true },
      series: s,
    };

    chartRef.current.setOption(option, { notMerge: true, lazyUpdate: true });

    return () => { /* keep instance for page reuse */ };
  }, [series, title]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
