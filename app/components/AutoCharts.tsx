'use client';
import React, { useMemo } from 'react';
import { ChartGallery, Empty } from './ChartKit';
import ChartCard from './ChartCard';

type Choice = { title:string; type:'histogram'|'bar'|'line'|'pie'|'scatter'|'bubble'; x?:string; y?:string; g?:string; note?:string };

function isNumber(x:any){ return typeof x === 'number' || (!!x && !isNaN(Number(x))); }
function looksDateSample(xs:any[]):boolean{
  for(const v of xs.slice(0,20)){ const s=String(v); if(isNaN(Date.parse(s))) return false; }
  return xs.length>0;
}
function cardinality(xs:any[]){ return new Set(xs.map(v=>String(v))).size; }

export default function AutoCharts({rows}:{rows:any[]}) {
  const choices = useMemo<Choice[]>(()=>{
    if(!rows || !rows.length) return [];
    const cols = Object.keys(rows[0]);
    const sample = (c:string)=> rows.map(r=>r[c]).filter(v=>v!==undefined && v!==null);
    const numCols = cols.filter(c => sample(c).every(isNumber));
    const catCols = cols.filter(c => !numCols.includes(c));
    const dateCols = cols.filter(c => looksDateSample(sample(c)));

    // Rank numeric by variance
    const varRank = numCols.map(c=>{
      const xs = sample(c).map(Number) as number[];
      const m = xs.reduce((a,b)=>a+b,0)/(xs.length||1);
      const v = xs.reduce((a,b)=>a+(b-m)**2,0)/(xs.length||1);
      return {c,v};
    }).sort((a,b)=>b.v-a.v).map(x=>x.c);

    // Rank categorical by cardinality (lower is better for bars/pies)
    const catRank = catCols
      .map(c=>({c,k:cardinality(sample(c))}))
      .sort((a,b)=>a.k-b.k)
      .map(x=>x.c);

    const picks: Choice[] = [];

    // Numeric distributions
    if(varRank.length) picks.push({title:`Distribution of ${varRank[0]}`, type:'histogram', x:varRank[0], note:'Spread & skew of values'});
    if(varRank.length>1) picks.push({title:`Distribution of ${varRank[1]}`, type:'histogram', x:varRank[1]});

    // Category composition
    if(catRank.length) picks.push({title:`Counts by ${catRank[0]}`, type:'bar', x:catRank[0], note:'Counts per category'});
    if(catRank.length>1) picks.push({title:`Share of ${catRank[1]}`, type:'pie', x:catRank[1], note:'Relative share'});

    // Numeric vs numeric (scatter)
    if(varRank.length>=2) picks.push({title:`${varRank[0]} vs ${varRank[1]}`, type:'scatter', x:varRank[0], y:varRank[1], note:'Relationship, clusters, outliers'});

    // Time series if date present
    if(dateCols.length){
      const d = dateCols[0];
      const y = varRank[0] || varRank[1];
      if(y) picks.push({title:`Trend of ${y} by ${d}`, type:'line', x:d, y, note:'Trend over time'});
    }

    if(!picks.length) picks.push({title:'Overview', type:'bar', x:cols[0]});
    return picks.slice(0,6);
  },[rows]);

  if(!rows?.length) return <Empty label="No data"/>;
  return (
    <div className="grid cols-3">
      {choices.map((c,i)=>(
        <ChartCard key={i} title={c.title} subtitle={c.note||''} fields={[c.x,c.y,c.g].filter(Boolean) as string[]}>
          <ChartGallery type={c.type} xField={c.x} yField={c.y} groupField={c.g} data={rows}/>
        </ChartCard>
      ))}
    </div>
  );
}
