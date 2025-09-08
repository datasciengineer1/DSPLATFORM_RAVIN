Replace your ChartCard titles with these templates (keeps your formatting/layout intact):

- Histogram card:
  <ChartCard title={`Histogram — ${x || columns[0] || "pick a numeric field"}`} ...>

- Scatter card:
  <ChartCard title={x && y ? `${x} vs ${y}` : "Scatter — pick X & Y"} ...>

- Line (agg) card:
  <ChartCard title={y ? `Line — ${y} by ${x || "(time/index)"}` : "Line (agg)"} ...>

- Pie card:
  <ChartCard title={x ? `Share of ${y || "count"} by ${x}` : "Pie — pick a category"} ...>

- Bubble card:
  <ChartCard title={x && y && group ? `Bubble — ${x}/${y} grouped by ${group}` : "Bubble"} ...>

- Bar (agg) card:
  <ChartCard title={x ? `Bar — ${y || "count"} by ${x}` : "Bar (agg)"} ...>
