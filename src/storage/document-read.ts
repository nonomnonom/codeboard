import { studioSchema } from "../model/schema/studio.js";
import type { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Panel, StoryboardDocument } from "../model/types.js";
import { storyboardSchema } from "../model/schema/project.js";
import { panelSchema } from "../model/schema/storyboard.js";
import { assertUniqueIds, validateRelationships } from "../model/validation/document.js";
import type { PayloadCodec } from "./codec.js";
import type { Header, PanelInfo } from "./types.js";
import { parseHeader } from "./header.js";
import { readRoot } from "./roots.js";
import { readRevisionRecord } from "./revisions.js";
import { selectFramePanels } from "../animation/frame.js";

// Call under the owner's read snapshot or write transaction.
export function readStoredHeader(db: DatabaseSync, codec: PayloadCodec): Header {
  return parseHeader(codec.read(readRoot(db, "document")));
}
export function readStoredStudio(
  db: DatabaseSync,
  codec: PayloadCodec,
): StoryboardDocument["studio"] {
  return Number(db.prepare("PRAGMA user_version").get()!.user_version) === 1
    ? { animations: [], editorial: [] }
    : (studioSchema.parse(codec.read(readRoot(db, "studio"))) as StoryboardDocument["studio"]);
}
export function listStoredPanels(db: DatabaseSync): PanelInfo[] {
  return db
    .prepare("SELECT info FROM panels ORDER BY position")
    .all()
    .map((r) => JSON.parse(String(r.info)));
}
export function readStoredPanel(
  db: DatabaseSync,
  codec: PayloadCodec,
  id: string,
  options: { revision?: string } = {},
): Panel {
  const row = options.revision
    ? readRevisionRecord(db, codec, options.revision).panels.find((p) => p.id === id)
    : db.prepare("SELECT id,info,hash FROM panels WHERE id=?").get(id);
  if (!row) throw new Error(`Panel not found: ${id}`);
  const panel = panelSchema.parse(codec.read(String(row.hash))) as Panel;
  const { layers, motion, ...info } = panel;
  if (panel.id !== id || !isDeepStrictEqual(info, JSON.parse(String(row.info))))
    throw new Error(`Panel index differs from artwork: ${id}`);
  return panel;
}
export function readStoredDocument(db: DatabaseSync, codec: PayloadCodec): StoryboardDocument {
  const document = storyboardSchema.parse({
    ...readStoredHeader(db, codec),
    studio: readStoredStudio(db, codec),
    panels: listStoredPanels(db).map((p) => readStoredPanel(db, codec, p.id)),
    components: db
      .prepare("SELECT hash FROM components ORDER BY position")
      .all()
      .map((r) => codec.read(String(r.hash))),
    changes: db
      .prepare("SELECT entry FROM changes ORDER BY position")
      .all()
      .map((r) => JSON.parse(String(r.entry))),
  }) as StoryboardDocument;
  assertUniqueIds(document);
  validateRelationships(document);
  return document;
}

/** Read only the panels needed for a validated frame under the caller's snapshot. */
export function readStoredFrame(
  db: DatabaseSync,
  codec: PayloadCodec,
  frame: number,
  options: { revision?: string } = {},
): StoryboardDocument {
  const revision = options.revision ? readRevisionRecord(db, codec, options.revision) : undefined;
  const header = revision
    ? parseHeader(codec.read(revision.documentHash))
    : readStoredHeader(db, codec);
  const metadata = revision
    ? revision.panels.map((row) => JSON.parse(row.info) as PanelInfo)
    : listStoredPanels(db);
  const { panel, incoming } = selectFramePanels(metadata, frame);
  return {
    ...header,
    panels: [panel, ...(incoming ? [incoming] : [])].map((p) =>
      readStoredPanel(db, codec, p.id, options),
    ),
    components: [],
    changes: [],
    studio: { animations: [], editorial: [] },
  };
}
