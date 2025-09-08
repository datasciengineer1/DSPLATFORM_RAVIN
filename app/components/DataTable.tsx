'use client';
import React, { useMemo, useState } from 'react';

export default function DataTable({ rows, pageSize=15 }: { rows:any[]; pageSize?:number }){
  const cols = useMemo(()=> rows?.[0] ? Object.keys(rows[0]) : [], [rows]);
  const size = Math.max(1, Math.min(pageSize, 15));
  const [page, setPage] = useState(0);
  const total = rows?.length || 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const slice = rows?.slice(page*size, page*size + size) || [];

  return (
    <div>
      <div style={{overflowX:'auto'}}>
        <table className="table">
          <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {slice.map((r,i)=>(
              <tr key={i}>{cols.map(c=><td key={c}>{format(r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="muted">Page {page+1} / {pages} · showing {slice.length} of {total}</span>
        <div className="pager-btns">
          <button className="btn" onClick={()=>setPage(0)} disabled={page===0}>« First</button>
          <button className="btn" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>‹ Prev</button>
          <button className="btn" onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1}>Next ›</button>
          <button className="btn" onClick={()=>setPage(pages-1)} disabled={page>=pages-1}>Last »</button>
        </div>
      </div>
    </div>
  );
}
function format(v:any){
  if (v==null) return '—';
  if (typeof v==='number') return Number.isInteger(v)? v : v.toFixed(3);
  return String(v);
}
