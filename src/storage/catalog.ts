import type { DatabaseSync } from "node:sqlite";
import type { Panel, StoryboardDocument } from "../model/types.js";
import { objectEntries } from "../model/inspection/objects.js";
import { summarizeProjectMetadata, projectSummarySchema } from "../model/inspection/summary.js";
import { isDeepStrictEqual } from "node:util";
import type { Header, PanelInfo } from "./types.js";
import { readRoot } from "./roots.js";
import { FORMAT_VERSION } from "./container.js";

/** Caller must establish catalogCurrent inside the same read snapshot. */
export function readCatalogMetadata(db: DatabaseSync) {
  return projectSummarySchema.parse(
    JSON.parse(String(db.prepare("SELECT summary FROM catalog_state WHERE id=1").get()!.summary)),
  );
}

export function catalogCurrent(db: DatabaseSync): boolean {
  if (Number(db.prepare("PRAGMA user_version").get()!.user_version) !== FORMAT_VERSION)
    return false;
  if (
    Number(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('object_catalog','catalog_state')",
        )
        .get()!.n,
    ) !== 2
  )
    return false;
  if (
    !db
      .prepare("PRAGMA table_info(catalog_state)")
      .all()
      .some((row) => row.name === "summary")
  )
    return false;
  const state = db.prepare("SELECT header_hash FROM catalog_state WHERE id=1").get();
  return state?.header_hash === readRoot(db, "document");
}

/** Rebuild derived metadata inside the caller's document-write transaction. */
export function indexObjects(db: DatabaseSync, document: StoryboardDocument): void {
  db.exec(`
      CREATE TABLE IF NOT EXISTS object_catalog(id TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,name_folded TEXT NOT NULL,parent_id TEXT,panel_id TEXT) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS catalog_parent ON object_catalog(parent_id,id);
      CREATE INDEX IF NOT EXISTS catalog_panel ON object_catalog(panel_id,id);
      CREATE INDEX IF NOT EXISTS catalog_kind ON object_catalog(kind,id);
      CREATE TABLE IF NOT EXISTS catalog_state(id INTEGER PRIMARY KEY CHECK(id=1),header_hash TEXT NOT NULL,summary TEXT NOT NULL);
      DELETE FROM object_catalog;`);
  if (
    !db
      .prepare("PRAGMA table_info(catalog_state)")
      .all()
      .some((row) => row.name === "summary")
  )
    db.exec("ALTER TABLE catalog_state ADD COLUMN summary TEXT NOT NULL DEFAULT 'null'");
  const insert = db.prepare("INSERT INTO object_catalog VALUES(?,?,?,?,?,?)");
  for (const item of objectEntries(document))
    insert.run(
      item.id,
      item.kind,
      item.name,
      item.name.toLowerCase(),
      item.parentId ?? null,
      item.panelId ?? null,
    );
  db.prepare(
    "INSERT INTO catalog_state VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET header_hash=excluded.header_hash,summary=excluded.summary",
  ).run(readRoot(db, "document"), JSON.stringify(summarizeProjectMetadata(document)));
}

export function updatePanelCatalog(
  db: DatabaseSync,
  header: Header,
  parsed: Panel,
  panels: PanelInfo[],
): void {
  const update = db.prepare(
    "UPDATE object_catalog SET kind=?,name=?,name_folded=?,parent_id=?,panel_id=? WHERE id=?",
  );
  for (const item of objectEntries({
    ...header,
    panels: [parsed],
    components: [],
    changes: [],
    comments: [],
    locks: [],
    studio: { animations: [], editorial: [] },
  })) {
    if (item.panelId !== parsed.id) continue;
    update.run(
      item.kind,
      item.name,
      item.name.toLowerCase(),
      item.parentId ?? null,
      item.panelId,
      item.id,
    );
  }
  const summary = summarizeProjectMetadata({
    ...header,
    panels: panels,
    components: db.prepare("SELECT id FROM components").all(),
  });
  db.prepare("UPDATE catalog_state SET header_hash=?,summary=? WHERE id=1").run(
    readRoot(db, "document"),
    JSON.stringify(summary),
  );
}

export function verifyCatalog(db: DatabaseSync, document: StoryboardDocument): void {
  const actual = db
    .prepare("SELECT id,kind,name,name_folded,parent_id,panel_id FROM object_catalog ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
  const expected = [...objectEntries(document)]
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      name_folded: item.name.toLowerCase(),
      parent_id: item.parentId ?? null,
      panel_id: item.panelId ?? null,
    }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  if (!isDeepStrictEqual(actual, expected))
    throw new Error("Object catalog differs from project metadata");
  const summary = JSON.parse(
    String(db.prepare("SELECT summary FROM catalog_state WHERE id=1").get()!.summary),
  );
  if (!isDeepStrictEqual(summary, summarizeProjectMetadata(document)))
    throw new Error("Catalog summary differs from project metadata");
}
