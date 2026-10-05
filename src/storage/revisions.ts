import { parseStoryboardDocument } from "../model/validation/document.js";
import type { DatabaseSync } from "node:sqlite";
import type { PayloadCodec } from "./codec.js";
import type { Header, SavedRevision, VersionRecord } from "./types.js";
import type { StoryboardDocument } from "../model/types.js";
import { pageBounds } from "../model/query.js";
import { assertUniqueIds, validateRelationships } from "../model/validation/document.js";
import { readRoot } from "./roots.js";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const versionRecordSchema = z
  .object({
    id: z.string().min(1),
    position: z.number().int().safe().nonnegative(),
    info: z.string(),
    hash: hashSchema,
  })
  .strict();
const revisionSchema = z
  .object({
    name: z.string().min(1).max(128),
    version: z.number().int().safe().nonnegative(),
    createdAt: z.string(),
    documentHash: hashSchema,
    changesHash: hashSchema,
    studioHash: hashSchema.optional(),
    panels: z.array(versionRecordSchema),
    components: z.array(versionRecordSchema),
    assets: z.array(z.object({ id: z.string().min(1), hash: hashSchema }).strict()),
  })
  .strict();

function parseRevisionRecord(input: unknown, name: string): SavedRevision {
  const record = revisionSchema.parse(input);
  if (!name.trim() || record.name !== name)
    throw new Error(`Revision name differs from root: ${name}`);
  for (const entries of [record.panels, record.components]) {
    const ids = new Set<string>();
    for (const [position, entry] of entries.entries()) {
      if (entry.position !== position || ids.has(entry.id))
        throw new Error(`Invalid revision object order or identity: ${name}/${entry.id}`);
      ids.add(entry.id);
    }
  }
  if (new Set(record.assets.map((asset) => asset.id)).size !== record.assets.length)
    throw new Error(`Duplicate revision asset identity: ${name}`);
  const { studioHash, ...required } = record;
  return { ...required, ...(studioHash === undefined ? {} : { studioHash }) };
}
export function readRevisionRecord(
  db: DatabaseSync,
  codec: PayloadCodec,
  name: string,
): SavedRevision {
  if (!name.trim() || name.length > 128)
    throw new Error("Revision name must contain 1–128 characters");
  return parseRevisionRecord(codec.read(readRoot(db, `revision:${name}`)), name);
}
/** The caller holds BEGIN IMMEDIATE and has checked the expected version. */
export function writeRevisionRecord(
  db: DatabaseSync,
  codec: PayloadCodec,
  name: string,
  version: number,
): void {
  if (db.prepare("SELECT 1 FROM roots WHERE key=?").get(`revision:${name}`))
    throw new Error(`Revision already exists: ${name}`);
  const snapshot: SavedRevision = {
    studioHash: readRoot(db, "studio"),
    name,
    version: version,
    createdAt: new Date().toISOString(),
    documentHash: readRoot(db, "document"),
    changesHash: codec.write(
      db
        .prepare("SELECT entry FROM changes ORDER BY position")
        .all()
        .map((r) => JSON.parse(String(r.entry))),
    ),
    panels: db
      .prepare("SELECT id,position,info,hash FROM panels ORDER BY position")
      .all() as unknown as VersionRecord[],
    components: db
      .prepare("SELECT id,position,info,hash FROM components ORDER BY position")
      .all() as unknown as VersionRecord[],
    assets: db.prepare("SELECT id,hash FROM assets ORDER BY id").all() as unknown as {
      id: string;
      hash: string;
    }[],
  };
  const hash = codec.write(parseRevisionRecord(snapshot, name));
  codec.retain(hash, [
    snapshot.documentHash,
    snapshot.changesHash,
    snapshot.studioHash!,
    ...snapshot.panels.map((p) => p.hash),
    ...snapshot.components.map((c) => c.hash),
    ...snapshot.assets.map((a) => a.hash),
  ]);
  db.prepare("INSERT INTO roots VALUES(?,?)").run(`revision:${name}`, hash);
}
export function listRevisionRecords(
  db: DatabaseSync,
  codec: PayloadCodec,
  options: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const { limit, offset } = pageBounds(options);
  return db
    .prepare("SELECT key,hash FROM roots WHERE key LIKE 'revision:%' ORDER BY key LIMIT ? OFFSET ?")
    .all(limit, offset)
    .map((r) => {
      const s = parseRevisionRecord(
        codec.read(String(r.hash)),
        String(r.key).slice("revision:".length),
      );
      return { name: s.name, version: s.version, createdAt: s.createdAt, panels: s.panels.length };
    });
}
export function readRevisionDocument(
  db: DatabaseSync,
  codec: PayloadCodec,
  name: string,
): StoryboardDocument {
  const s = readRevisionRecord(db, codec, name),
    header = codec.read<Header>(s.documentHash);
  const document = parseStoryboardDocument({
    ...header,
    ...(s.studioHash ? { studio: codec.read(s.studioHash) } : {}),
    panels: s.panels.map((p) => codec.read(p.hash)),
    components: s.components.map((c) => codec.read(c.hash)),
    changes: codec.read(s.changesHash),
  }) as StoryboardDocument;
  assertUniqueIds(document);
  validateRelationships(document);
  if (s.version !== document.version)
    throw new Error(`Revision identity or version differs from document: ${name}`);
  for (const [index, panel] of document.panels.entries()) {
    const entry = s.panels[index]!;
    const { layers, motion, ...info } = panel;
    if (entry.id !== panel.id || !isDeepStrictEqual(JSON.parse(entry.info), info))
      throw new Error(`Revision panel index differs from artwork: ${name}/${panel.id}`);
  }
  for (const [index, component] of document.components.entries()) {
    const entry = s.components[index]!;
    if (
      entry.id !== component.id ||
      !isDeepStrictEqual(JSON.parse(entry.info), {
        id: component.id,
        name: component.name,
        version: component.version,
      })
    )
      throw new Error(`Revision component index differs from artwork: ${name}/${component.id}`);
  }
  if (
    !isDeepStrictEqual(
      s.assets.map((asset) => asset.id).sort(),
      document.assets.map((asset) => asset.id).sort(),
    )
  )
    throw new Error(`Revision asset index differs from project assets: ${name}`);

  return document;
}
