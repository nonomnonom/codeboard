import type { PayloadCodec } from "./codec.js";
import type { DatabaseSync } from "node:sqlite";
export function readRoot(db: DatabaseSync, key: string): string {
  const row = db.prepare("SELECT hash FROM roots WHERE key=?").get(key);
  if (!row) throw new Error(`Missing project root: ${key}`);
  return String(row.hash);
}

export function writeRoot(
  db: DatabaseSync,
  codec: PayloadCodec,
  key: string,
  value: unknown,
): void {
  db.prepare(
    "INSERT INTO roots VALUES(?,?) ON CONFLICT(key) DO UPDATE SET hash=excluded.hash WHERE hash<>excluded.hash",
  ).run(key, codec.write(value));
}
