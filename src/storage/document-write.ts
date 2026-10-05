import { allLayers } from "../model/layers.js";
import {
  readStoredHeader,
  readStoredPanel,
  readStoredStudio,
  listStoredPanels,
} from "./document-read.js";
import type { DatabaseSync } from "node:sqlite";
import type { PayloadCodec } from "./codec.js";
import type { Panel, StoryboardDocument } from "../model/types.js";
import type { SaveOptions } from "./types.js";
import { parseHeader } from "./header.js";
import { writeRoot } from "./roots.js";
import { panelIdentities, preparePanelUpdate } from "./panel-update.js";
import { embedAssets } from "./assets.js";
import { catalogCurrent, indexObjects, updatePanelCatalog } from "./catalog.js";
import { CodeboardError } from "../model/errors.js";
import { storyboardSchema } from "../model/schema/project.js";
import { assertUniqueIds, validateRelationships } from "../model/validation/document.js";

/** The caller owns the write transaction, including rollback on failure. */
export function writePanel(
  db: DatabaseSync,
  codec: PayloadCodec,
  panel: Panel,
  position: number,
  hash = codec.write(panel),
): void {
  const { layers, motion, ...info } = panel;
  const prior = db.prepare("SELECT hash,position FROM panels WHERE id=?").get(panel.id);
  if (prior?.hash === hash && prior.position === position) return;
  db.prepare(
    "INSERT INTO panels VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,info=excluded.info,hash=excluded.hash",
  ).run(panel.id, position, JSON.stringify(info), hash);
  db.prepare("DELETE FROM objects WHERE panel_id=?").run(panel.id);
  const insert = db.prepare("INSERT INTO objects VALUES(?,?,?,?)");
  for (const item of panelIdentities(panel)) insert.run(item.id, panel.id, item.name, item.kind);
}

/** Write content and indexes under the caller's existing immediate transaction. */
export function writeDocument(
  db: DatabaseSync,
  codec: PayloadCodec,
  path: string,
  document: StoryboardDocument,
  options: SaveOptions,
): number {
  storyboardSchema.parse(document);
  assertUniqueIds(document);
  validateRelationships(document);
  const existing = db.prepare("SELECT hash FROM roots WHERE key='document'").get();
  const priorHeader = existing ? parseHeader(codec.read(String(existing.hash))) : undefined;
  if (priorHeader && !options.overwrite && priorHeader.version !== options.expectedVersion)
    throw new CodeboardError(
      "REVISION_CONFLICT",
      `Disk version conflict: expected ${options.expectedVersion ?? "new file"}, found ${priorHeader.version}`,
      { details: { expected: options.expectedVersion ?? null, actual: priorHeader.version } },
    );
  const writesBefore = Number(db.prepare("SELECT total_changes() AS n").get()!.n);
  const { panels, components, changes, studio, ...header } = document;
  writeRoot(db, codec, "studio", studio);
  writeRoot(db, codec, "document", header);
  for (const row of db.prepare("SELECT id FROM panels").all())
    if (!panels.some((p) => p.id === row.id))
      db.prepare("DELETE FROM panels WHERE id=?").run(row.id!);
  const encoded = panels.map((panel, position) => ({
    panel,
    position,
    hash: codec.write(panel),
  }));
  // Release old ownership for every changed panel before transferring IDs between them.
  for (const item of encoded) {
    const prior = db.prepare("SELECT hash,position FROM panels WHERE id=?").get(item.panel.id);
    if (prior?.hash !== item.hash || prior.position !== item.position)
      db.prepare("DELETE FROM objects WHERE panel_id=?").run(item.panel.id);
  }
  encoded.forEach(({ panel, position, hash }) => {
    writePanel(db, codec, panel, position, hash);
  });
  for (const row of db.prepare("SELECT id FROM components").all())
    if (!components.some((c) => c.id === row.id))
      db.prepare("DELETE FROM components WHERE id=?").run(row.id!);
  components.forEach((c, i) => {
    db.prepare(
      "INSERT INTO components VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,info=excluded.info,hash=excluded.hash WHERE hash<>excluded.hash OR position<>excluded.position",
    ).run(c.id, i, JSON.stringify({ id: c.id, name: c.name, version: c.version }), codec.write(c));
  });
  db.prepare("DELETE FROM changes WHERE position>=?").run(changes.length);
  changes.forEach((c, i) => {
    db.prepare(
      "INSERT INTO changes VALUES(?,?) ON CONFLICT(position) DO UPDATE SET entry=excluded.entry WHERE entry<>excluded.entry",
    ).run(i, JSON.stringify(c));
  });
  embedAssets(
    db,
    codec,
    path,
    document.assets,
    priorHeader?.id === document.id ? priorHeader.assets : undefined,
    options,
  );
  const changed = Number(db.prepare("SELECT total_changes() AS n").get()!.n) !== writesBefore;
  if (priorHeader && (changed || options.overwrite) && header.version <= priorHeader.version) {
    header.version = priorHeader.version + 1;
    if (!Number.isSafeInteger(header.version))
      throw new Error("Project version exceeds the safe integer range");
    writeRoot(db, codec, "document", header);
  }
  if (!catalogCurrent(db)) indexObjects(db, { ...document, version: header.version });
  return header.version;
}

/** Publish a targeted panel revision under the caller's immediate write transaction. */
export function writePanelUpdate(
  db: DatabaseSync,
  codec: PayloadCodec,
  panel: Panel,
  options: { expectedVersion: number; actor?: string },
): void {
  const header = readStoredHeader(db, codec),
    old = readStoredPanel(db, codec, panel.id),
    actor = options.actor ?? "agent:local";
  const indexed = catalogCurrent(db);
  if (header.version !== options.expectedVersion)
    throw new CodeboardError(
      "REVISION_CONFLICT",
      `Disk version conflict: expected ${options.expectedVersion}, found ${header.version}`,
      { details: { expected: options.expectedVersion, actual: header.version } },
    );
  const components = db
    .prepare("SELECT info FROM components")
    .all()
    .map((row) => JSON.parse(String(row.info)));
  const hasBindings = allLayers(panel.layers).some(
    (layer) =>
      layer.kind !== "group" &&
      layer.elements.some((element) => element.colorBindings !== undefined),
  );
  const parsed = preparePanelUpdate(
    header,
    old,
    panel,
    actor,
    listStoredPanels(db),
    components,
    hasBindings ? readStoredStudio(db, codec).palettes : undefined,
  );
  const position = Number(
    db.prepare("SELECT position FROM panels WHERE id=?").get(panel.id)!.position,
  );
  writePanel(db, codec, parsed, position);
  header.version++;
  header.updatedAt = new Date().toISOString();
  writeRoot(db, codec, "document", header);
  if (indexed) {
    updatePanelCatalog(db, header, parsed, listStoredPanels(db));
  }
  const index = Number(
    db.prepare("SELECT COALESCE(MAX(position),-1)+1 AS n FROM changes").get()!.n,
  );
  db.prepare("INSERT INTO changes VALUES(?,?)").run(
    index,
    JSON.stringify({
      id: `change:store:${header.version}`,
      version: header.version,
      actor,
      operation: "update panel artwork",
      targetIds: [panel.id],
      timestamp: header.updatedAt,
    }),
  );
}
