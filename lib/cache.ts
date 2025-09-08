import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "nlq_cache.json");

export type LexWeights = Record<string, number>;

export type CacheItem = {
  id: string;
  question: string;
  lang?: string;
  explanation: string;
  ts: string;
  // hybrid vectors (optional for older entries)
  dense?: number[];
  sparse?: LexWeights;
  colbert?: number[][]; // token-level vectors
};

export function ensureDataDir(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, "[]", "utf-8");
}
export function readCache(): CacheItem[] {
  ensureDataDir(); return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")||"[]");
}
export function writeCache(items: CacheItem[]){
  ensureDataDir(); fs.writeFileSync(CACHE_FILE, JSON.stringify(items,null,2), "utf-8");
}
export function hashId(s: string){
  let h=2166136261; for(const ch of s.toLowerCase()){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
  return String(h>>>0);
}
export function upsertCache(rec: CacheItem){
  const items = readCache();
  const i = items.findIndex(x=>x.id===rec.id);
  if (i>=0) items[i]=rec; else items.unshift(rec);
  writeCache(items);
}
export function deleteByQuestion(q: string){
  const id = hashId(q);
  writeCache(readCache().filter(x=>x.id!==id));
}
