export type ChartTitleParts = {
  datasetName?: string | null;
  column?: string | null;
  yColumn?: string | null;
  chartType?: string | null;
  aggregation?: string | null;
  timeGrain?: string | null;
};
const pretty = (s?: string | null) =>
  (s || "").trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function makeChartTitle({ datasetName, column, yColumn, chartType, aggregation, timeGrain }: ChartTitleParts): string {
  const parts: string[] = [];
  if (chartType) {
    const ct = pretty(chartType);
    if (column && yColumn) parts.push(`${ct} of ${pretty(yColumn)} vs ${pretty(column)}`);
    else if (column) parts.push(`${ct} of ${pretty(column)}`);
    else parts.push(ct);
  } else if (column) parts.push(pretty(column));
  const quals: string[] = [];
  if (aggregation) quals.push(pretty(aggregation));
  if (timeGrain) quals.push(pretty(timeGrain));
  if (quals.length) parts.push(`(${quals.join(" • ")})`);
  if (datasetName) parts.push(`— ${pretty(datasetName)}`);
  return parts.join(" ") || "Chart";
}
