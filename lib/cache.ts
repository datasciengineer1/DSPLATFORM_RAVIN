import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "nlq_cache.json");

type CacheItem = {
  id: string; question: string; lang?: string;
  vec?: number[]; explanation: string; ts: string;
};

export function ensureDataDir(){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR); if(!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE,"[]","utf-8"); }
export function readCache(): CacheItem[] { ensureDataDir(); return JSON.parse(fs.readFileSync(CACHE_FILE,"utf-8")||"[]"); }
export function writeCache(items: CacheItem[]){ ensureDataDir(); fs.writeFileSync(CACHE_FILE, JSON.stringify(items,null,2),"utf-8"); }
export function hashId(s: string){ let h=2166136261; for(const ch of s.toLowerCase()) { h^=ch.charCodeAt(0); h = Math.imul(h,16777619);} return String(h>>>0); }
export function putCache(q:string, lang:string|undefined, vec:number[]|undefined, explanation:string){
  const items = readCache();
  const id = hashId(q);
  const existingIdx = items.findIndex(x=>x.id===id);
  const rec = { id, question:q, lang, vec, explanation, ts: new Date().toISOString() };
  if(existingIdx>=0) items[existingIdx]=rec; else items.unshift(rec);
  writeCache(items);
  return id;
}
export function deleteByQuestion(q:string){
  const id = hashId(q);
  const items = readCache().filter(x=>x.id!==id);
  writeCache(items);
}
