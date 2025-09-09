'use client';
import React, { useEffect, useState } from 'react';

type Props = { onLoad:(rows:any[], meta:{source:string; id:string})=>void };
function parseCSV(text:string): any[] {
  const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[0].split(',');
  const rows:any[] = [];
  for(let i=1;i<lines.length;i++){
    const cells = (lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []).map(s=>s.replace(/^"(.*)"$/,'$1'));
    const obj:any = {};
    headers.forEach((h,idx)=>{const raw=cells[idx]; const n=Number(raw); obj[h]= (raw===''||raw==null)? null : (Number.isFinite(n)? n : raw);});
    rows.push(obj);
  }
  return rows;
}

export default function DBConnector({ onLoad }: Props){
  const [tab,setTab]=useState<'demo'|'csv'|'postgres'|'sqlite'|'bigquery'>('demo');
  const [demo, setDemo] = useState<any[]>([]);
  const [demoId, setDemoId] = useState('');
  const [csvName, setCsvName] = useState('');
  const [pgUrl,setPgUrl]=useState(''); const [pgTable,setPgTable]=useState(''); const [pgSql,setPgSql]=useState('');
  const [sqFile,setSqFile]=useState(''); const [sqTable,setSqTable]=useState(''); const [sqSql,setSqSql]=useState('');
  const [bqTable,setBqTable]=useState(''); const [bqSql,setBqSql]=useState('');
  const [err,setErr]=useState<string>(''); const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{ try{
    const r = await fetch('/api/data/sources'); const j = await r.json();
    setDemo(j||[]); if(j?.length){ setDemoId(j[0].id); }
  }catch{}})()},[]);

  async function loadDemo(){
    setBusy(true); setErr('');
    try{
      const r = await fetch('/api/data/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:demoId,limit:200})});
      const j = await r.json();
      onLoad(j.rows||[], {source:'demo', id: demoId});
    }catch(e:any){ setErr(e?.message||String(e)); } finally{ setBusy(false); }
  }
  async function callDb(body:any, meta:{source:string; id:string}){
    setBusy(true); setErr('');
    try{
      const r = await fetch('/api/data/db/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const j = await r.json(); if(j.error) throw new Error(j.error);
      onLoad(j.rows||[], meta);
    }catch(e:any){ setErr(e?.message||String(e)); } finally{ setBusy(false); }
  }

  return (
    <div className="card">
      <h2>Data sources</h2>
      <div className="body" style={{display:'grid', gap:12}}>
        <div className="tabs">
          {(['demo','csv','postgres','sqlite','bigquery'] as const).map(k=>(
            <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{k.toUpperCase()}</button>
          ))}
        </div>

        {tab==='demo' && (
          <div className="grid3">
            <div>
              <div className="muted">Demo dataset</div>
              <select className="select" value={demoId} onChange={e=>setDemoId(e.target.value)}>
                {demo.map((d:any)=><option key={d.id} value={d.id}>{d.name||d.id}</option>)}
              </select>
            </div>
            <div/>
            <div style={{alignSelf:'end', justifySelf:'end'}}><button className="btn" onClick={loadDemo} disabled={busy}>Load</button></div>
          </div>
        )}

        {tab==='csv' && (
          <div className="grid3">
            <div style={{gridColumn:'1 / 3'}}>
              <div className="muted">Upload CSV</div>
              <input className="input" type="file" accept=".csv" onChange={async e=>{
                const f = e.target.files?.[0]; if(!f) return;
                const text = await f.text(); const rows = parseCSV(text);
                setCsvName(f.name); onLoad(rows, {source:'upload', id:`upload:${f.name}`});
              }}/>
              {csvName && <div className="muted" style={{marginTop:6}}>Loaded: {csvName}</div>}
            </div>
          </div>
        )}

        {tab==='postgres' && (
          <div className="grid3">
            <div><div className="muted">Connection URL</div><input className="input" placeholder="postgres://user:pass@host:5432/db" value={pgUrl} onChange={e=>setPgUrl(e.target.value)}/></div>
            <div><div className="muted">Table (or leave blank and use SQL)</div><input className="input" placeholder="schema.table" value={pgTable} onChange={e=>setPgTable(e.target.value)}/></div>
            <div style={{gridColumn:'1 / 3'}}>
              <div className="muted">Custom SQL (optional)</div>
              <textarea className="input" placeholder="SELECT * FROM schema.table LIMIT 200" value={pgSql} onChange={e=>setPgSql(e.target.value)} />
            </div>
            <div style={{alignSelf:'end', justifySelf:'end'}}>
              <button className="btn" onClick={()=>callDb({source:'postgres',config:{url:pgUrl},table:pgTable,sql:pgSql||undefined,limit:200},{source:'postgres',id:pgTable||'sql'})} disabled={busy || !pgUrl || (!pgTable && !pgSql)}>Test & Load</button>
            </div>
          </div>
        )}

        {tab==='sqlite' && (
          <div className="grid3">
            <div><div className="muted">File (absolute path)</div><input className="input" placeholder="/path/to/db.sqlite" value={sqFile} onChange={e=>setSqFile(e.target.value)}/></div>
            <div><div className="muted">Table (or leave blank and use SQL)</div><input className="input" placeholder="table" value={sqTable} onChange={e=>setSqTable(e.target.value)}/></div>
            <div style={{gridColumn:'1 / 3'}}>
              <div className="muted">Custom SQL (optional)</div>
              <textarea className="input" placeholder="SELECT * FROM table LIMIT 200" value={sqSql} onChange={e=>setSqSql(e.target.value)} />
            </div>
            <div style={{alignSelf:'end', justifySelf:'end'}}>
              <button className="btn" onClick={()=>callDb({source:'sqlite',config:{file:sqFile},table:sqTable||undefined,sql:sqSql||undefined,limit:200},{source:'sqlite',id:sqTable||'sql'})} disabled={busy || !sqFile || (!sqTable && !sqSql)}>Test & Load</button>
            </div>
          </div>
        )}

        {tab==='bigquery' && (
          <div className="grid3">
            <div><div className="muted">Table (or leave blank and use SQL)</div><input className="input" placeholder="project.dataset.table" value={bqTable} onChange={e=>setBqTable(e.target.value)}/></div>
            <div style={{gridColumn:'1 / 3'}}>
              <div className="muted">Custom SQL (optional)</div>
              <textarea className="input" placeholder="SELECT * FROM `project.dataset.table` LIMIT 200" value={bqSql} onChange={e=>setBqSql(e.target.value)} />
            </div>
            <div style={{alignSelf:'end', justifySelf:'end'}}>
              <button className="btn" onClick={()=>callDb({source:'bigquery',config:{},table:bqTable||undefined,sql:bqSql||undefined,limit:200},{source:'bigquery',id:bqTable||'sql'})} disabled={busy || (!bqTable && !bqSql)}>Test & Load</button>
            </div>
          </div>
        )}

        {err && <div style={{color:'#b91c1c'}}>Error: {err}</div>}
      </div>
    </div>
  );
}
