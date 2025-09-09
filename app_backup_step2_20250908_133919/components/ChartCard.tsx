'use client';
import React from 'react';
export default function ChartCard({
  title, subtitle, fields, children
}:{title:string; subtitle?:string; fields?:string[]; children:React.ReactNode}){
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="body">
        {subtitle && <div className="muted" style={{marginBottom:8}}>{subtitle}</div>}
        {fields && fields.length>0 && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            {fields.map((f,i)=><span key={i} style={{padding:'2px 6px',border:'1px solid #0002',borderRadius:999,fontSize:12}}>{f}</span>)}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
