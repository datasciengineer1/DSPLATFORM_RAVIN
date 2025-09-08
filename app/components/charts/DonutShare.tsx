"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#a855f7","#06b6d4","#e11d48","#84cc16"];

export default function DonutShare({
  data, topN=6, height=260
}: { data: Array<{name:string; value:number}>; topN?: number; height?: number }) {
  const sorted = [...(data||[])].sort((a,b)=>b.value-a.value);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);
  const other = tail.reduce((s,d)=>s+d.value,0);
  const final = other>0 ? [...head, { name:"Other", value:other }] : head;

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={final}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
          >
            {final.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
