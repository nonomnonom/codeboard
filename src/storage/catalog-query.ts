import type { DatabaseSync } from "node:sqlite";
import type { StoryboardDocument, ObjectQuery, ObjectSummary } from "../model/types.js";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse } from "../model/query.js";
import { objectEntries, boundObjectPage, matchesObjectQuery } from "../model/inspection/objects.js";
import { summarizeProject } from "../model/inspection/summary.js";
import { catalogCurrent, readCatalogMetadata } from "./catalog.js";

export function queryCatalog(
  db: DatabaseSync,
  query: ObjectQuery,
  expected: number | undefined,
  limit: number,
  offset: number,
  readDocument: () => StoryboardDocument,
) {
  const indexed = catalogCurrent(db);
  let items: ObjectSummary[];
  let summary: ReturnType<typeof summarizeProject>;
  if (indexed) {
    const metadata = readCatalogMetadata(db);
    const { titleTruncated, ...required } = metadata;
    summary = {
      ...required,
      ...(titleTruncated ? { titleTruncated: true } : {}),
      studio: readStudioCounts(db),
    };
    if (expected !== undefined && expected !== summary.version)
      throw new CodeboardError("REVISION_CONFLICT", "Project version changed; restart the query", {
        details: { expected, actual: summary.version },
      });
    const clauses: string[] = [],
      args: (string | number)[] = [];
    for (const [column, value] of [
      ["id", query.id],
      ["kind", query.kind],
      ["parent_id", query.parentId],
      ["panel_id", query.panelId],
    ] as const) {
      if (value !== undefined) {
        clauses.push(`${column}=?`);
        args.push(value);
      }
    }
    if (query.name !== undefined) {
      clauses.push("instr(name_folded,?)>0");
      args.push(query.name.toLowerCase());
    }
    const rows = db
      .prepare(
        `SELECT id,kind,name,parent_id,panel_id FROM object_catalog${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY id LIMIT ? OFFSET ?`,
      )
      .all(...args, limit, offset);
    items = rows.map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      name: String(row.name),
      ...(row.parent_id === null ? {} : { parentId: String(row.parent_id) }),
      ...(row.panel_id === null ? {} : { panelId: String(row.panel_id) }),
    }));
  } else {
    const document = readDocument();
    summary = summarizeProject(document);
    if (expected !== undefined && expected !== summary.version)
      throw new CodeboardError("REVISION_CONFLICT", "Project version changed; restart the query", {
        details: { expected, actual: summary.version },
      });
    // Sorting the metadata only keeps legacy and indexed offset order identical.
    const entries = [...objectEntries(document)].sort((a, b) =>
      Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)),
    );
    const name = query.name?.toLowerCase();
    let skipped = 0;
    items = [];
    for (const entry of entries) {
      if (!matchesObjectQuery(entry, query, name)) continue;
      if (skipped++ < offset) continue;
      items.push(entry);
      if (items.length === limit) break;
    }
  }
  const result = { summary, indexed, ...boundObjectPage({ version: summary.version, items }) };
  return boundQueryResponse(result, "Stored query response");
}

/** Count derived studio records without decoding animation artwork or audio payloads. */
function readStudioCounts(db: DatabaseSync): ReturnType<typeof summarizeProject>["studio"] {
  const studio = {
    animations: 0,
    editorialSequences: 0,
    editorialClips: 0,
    audioTracks: 0,
    audioClips: 0,
  };
  const keys = {
    "shot-animation": "animations",
    "editorial-sequence": "editorialSequences",
    "editorial-clip": "editorialClips",
    "studio-audio-track": "audioTracks",
    "studio-audio-clip": "audioClips",
  } as const;
  const rows = db
    .prepare(
      "SELECT kind,COUNT(*) AS count FROM object_catalog WHERE kind IN ('shot-animation','editorial-sequence','editorial-clip','studio-audio-track','studio-audio-clip') GROUP BY kind",
    )
    .all();
  for (const row of rows) {
    const key = keys[String(row.kind) as keyof typeof keys];
    const count = Number(row.count);
    if (!key || !Number.isSafeInteger(count) || count < 0)
      throw new Error("Invalid studio catalog count");
    studio[key] = count;
  }
  return studio;
}
