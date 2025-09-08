export type SeriesPick = {
  xKey: string;
  yKey: string;
  data: Array<{ x: number | Date | string; y: number; [k: string]: any }>;
};

const LOWER_PREFS = [
  "profit_margin","margin","gross_margin","gm","gm%","revenue","sales",
  "net_sales","turnover","amount","value","y","qty","units","cogs"
];

export function chooseSeries(rows: any[]): SeriesPick {
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length || typeof data[0] !== "object") {
    return { xKey: "index", yKey: "value", data: [] };
  }
  const sample = data[0];
  const keys = Object.keys(sample || []);
  const lower = (s: string) => s.toLowerCase();

  const timeCandidates = keys.filter(k =>
    /(^(date|ds|time|timestamp|period|month|quarter|week)$|date|time|month|quarter|week|timestamp)/i.test(k)
  );
  let xKey = timeCandidates[0] || "";

  let yKey = "";
  const lowerKeys = keys.map(lower);
  for (const n of LOWER_PREFS) {
    const idx = lowerKeys.indexOf(n);
    if (idx >= 0) { yKey = keys[idx]; break; }
  }
  if (!yKey) {
    for (const k of keys) {
      if (k === xKey) continue;
      const anyVal = data.find(r => r && r[k] != null);
      if (!anyVal) continue;
      const n = Number(anyVal[k]);
      if (Number.isFinite(n)) { yKey = k; break; }
    }
  }
  if (!yKey) yKey = keys.find(k => k !== xKey) || keys[0];

  const mapped = data.map((r, i) => {
    let x: any = xKey ? r[xKey] : i;
    if (xKey && typeof x === "string") {
      const d = new Date(x);
      if (!isNaN(d.valueOf())) x = d;
    }
    const y = Number(r[yKey]);
    return { ...r, x, y };
  }).filter(r => Number.isFinite(r.y));

  mapped.sort((a, b) => {
    const ax = a.x instanceof Date ? a.x.getTime() : (typeof a.x === "number" ? a.x : 0);
    const bx = b.x instanceof Date ? b.x.getTime() : (typeof b.x === "number" ? b.x : 0);
    return ax - bx;
  });

  return { xKey: xKey || "index", yKey: yKey || "value", data: mapped };
}
