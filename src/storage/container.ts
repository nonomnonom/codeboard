import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const APPLICATION_ID = 0x43425244;
export const FORMAT_VERSION = 3;
export function openContainer(path: string, create: boolean): DatabaseSync {
  if (!create && !existsSync(path)) throw new Error(`Project does not exist: ${path}`);
  if (create) mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;",
    );
    const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
    const app = Number(db.prepare("PRAGMA application_id").get()!.application_id);
    if (
      version === 0 &&
      app === 0 &&
      create &&
      !db.prepare("SELECT name FROM sqlite_master WHERE type='table'").get()
    ) {
      db.exec(`BEGIN IMMEDIATE;
          PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${FORMAT_VERSION};
          CREATE TABLE payloads(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,codec TEXT NOT NULL CHECK(codec IN ('br','raw')),raw_size INTEGER NOT NULL CHECK(raw_size>=0),data BLOB NOT NULL);
          CREATE TABLE roots(key TEXT PRIMARY KEY,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE payload_links(parent TEXT NOT NULL REFERENCES payloads(hash) ON DELETE CASCADE,child TEXT NOT NULL REFERENCES payloads(hash) ON DELETE CASCADE,PRIMARY KEY(parent,child)) WITHOUT ROWID;
          CREATE TABLE panels(id TEXT PRIMARY KEY,position INTEGER NOT NULL,info TEXT NOT NULL,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE components(id TEXT PRIMARY KEY,position INTEGER NOT NULL,info TEXT NOT NULL,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE objects(id TEXT PRIMARY KEY,panel_id TEXT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,name TEXT NOT NULL,kind TEXT NOT NULL) WITHOUT ROWID;
          CREATE INDEX objects_panel ON objects(panel_id);
          CREATE TABLE assets(id TEXT PRIMARY KEY,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE changes(position INTEGER PRIMARY KEY,entry TEXT NOT NULL);
          COMMIT;`);
    } else if (
      (version !== 1 && version !== 2 && version !== FORMAT_VERSION) ||
      app !== APPLICATION_ID
    )
      throw new Error(`Unsupported project container (application ${app}, version ${version})`);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
