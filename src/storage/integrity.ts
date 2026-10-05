import type { DatabaseSync } from "node:sqlite";
import type { StoryboardDocument } from "../model/types.js";
import { isDeepStrictEqual } from "node:util";
import { verifyReceipts } from "./receipts.js";
import { digest, type PayloadCodec } from "./codec.js";
import { catalogCurrent, verifyCatalog } from "./catalog.js";
import { panelIdentities } from "./panel-update.js";
import { readEmbeddedAsset } from "./assets.js";
import { readRevisionRecord, readRevisionDocument } from "./revisions.js";

function verifySavedRevisions(db: DatabaseSync, codec: PayloadCodec): void {
  for (const row of db
    .prepare("SELECT key FROM roots WHERE key LIKE 'revision:%' ORDER BY key")
    .all()) {
    const name = String(row.key).slice("revision:".length);
    const record = readRevisionRecord(db, codec, name);
    const document = readRevisionDocument(db, codec, name);
    for (const asset of document.assets) {
      const entry = record.assets.find((item) => item.id === asset.id)!;
      const bytes = codec.get(entry.hash, "asset");
      if (asset.checksum && digest(bytes) !== asset.checksum)
        throw new Error(`Revision asset checksum mismatch: ${name}/${asset.id}`);
    }
  }
}

/** The caller holds one read snapshot for all authoritative and derived records. */
export function verifyContainer(
  db: DatabaseSync,
  codec: PayloadCodec,
  readDocument: () => StoryboardDocument,
): void {
  const result = db.prepare("PRAGMA integrity_check").get();
  if (result?.integrity_check !== "ok")
    throw new Error(`SQLite integrity failure: ${JSON.stringify(result)}`);
  if (db.prepare("PRAGMA foreign_key_check").get()) throw new Error("Broken project references");
  for (const row of db.prepare("SELECT hash FROM payloads").all()) codec.get(String(row.hash));
  verifyReceipts(db, codec);
  const document = readDocument();
  if (catalogCurrent(db)) {
    verifyCatalog(db, document);
  }
  for (const panel of document.panels) {
    const indexed = db
      .prepare("SELECT id,name,kind FROM objects WHERE panel_id=?")
      .all(panel.id)
      .map((row) => ({ ...row }));
    const expected = new Map(panelIdentities(panel).map((item) => [item.id, item]));
    if (
      indexed.length !== expected.size ||
      indexed.some((item) => !isDeepStrictEqual(item, expected.get(String(item.id))))
    )
      throw new Error(`Object index differs from artwork: ${panel.id}`);
  }
  for (const [index, row] of db
    .prepare("SELECT id,info FROM components ORDER BY position")
    .all()
    .entries()) {
    const component = document.components[index];
    if (
      !component ||
      component.id !== row.id ||
      !isDeepStrictEqual(JSON.parse(String(row.info)), {
        id: component.id,
        name: component.name,
        version: component.version,
      })
    )
      throw new Error(`Component index differs from artwork: ${row.id}`);
  }
  const assets = db
    .prepare("SELECT id FROM assets")
    .all()
    .map((row) => String(row.id))
    .sort();
  if (!isDeepStrictEqual(assets, document.assets.map((asset) => asset.id).sort()))
    throw new Error("Embedded asset index differs from project assets");
  for (const asset of document.assets) {
    const bytes = readEmbeddedAsset(db, codec, asset.id);
    if (asset.checksum && digest(bytes) !== asset.checksum)
      throw new Error(`Asset checksum mismatch: ${asset.id}`);
  }
  verifySavedRevisions(db, codec);
}
