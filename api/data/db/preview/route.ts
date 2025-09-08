import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import sqlite3 from 'sqlite3';

type Source = 'postgres'|'sqlite'|'bigquery';
type Cfg = Record<string, any>;

export async function POST(req: NextRequest) {
  const { source, config, table, limit = 200, sql } =
    await req.json() as { source: Source, config: Cfg, table?: string, limit?: number, sql?: string };

  try {
    if (source === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: config?.url || process.env.PG_URL });
      await client.connect();
      const q = sql || `SELECT * FROM ${table} LIMIT ${limit};`;
      const res = await client.query(q);
      await client.end();
      return NextResponse.json({ rows: res.rows });
    }

    if (source === 'sqlite') {
      const file = config?.file || process.env.SQLITE_PATH;
      if (!file) return NextResponse.json({ error: 'Missing SQLite file path' }, { status: 400 });
      if (!fs.existsSync(file)) return NextResponse.json({ error: `SQLite file not found: ${file}` }, { status: 400 });

      sqlite3.verbose();
      const rows = await new Promise<any[]>((resolve, reject) => {
        const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (err) => {
          if (err) { reject(err); return; }
          const q = sql || `SELECT * FROM ${table} LIMIT ${limit};`;
          db.all(q, (err2, out) => {
            db.close();
            if (err2) reject(err2);
            else resolve(out || []);
          });
        });
      });
      return NextResponse.json({ rows });
    }

    if (source === 'bigquery') {
      const { BigQuery } = await import('@google-cloud/bigquery');
      // Needs GOOGLE_APPLICATION_CREDENTIALS or ADC via gcloud
      const bq = new BigQuery(config?.options || {});
      const q = sql || `SELECT * FROM \`${table}\` LIMIT ${limit}`;
      const [job] = await bq.createQueryJob({ query: q });
      const [rows] = await job.getQueryResults();
      return NextResponse.json({ rows });
    }

    return NextResponse.json({ error: 'Unsupported source' }, { status: 400 });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
