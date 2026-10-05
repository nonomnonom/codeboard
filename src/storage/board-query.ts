import type { DatabaseSync } from "node:sqlite";
import type { Header } from "./types.js";
import { catalogCurrent, readCatalogMetadata } from "./catalog.js";
import { panelSchema } from "../model/schema/storyboard.js";
import { boundQueryResponse } from "../model/query.js";
import { CodeboardError } from "../model/errors.js";

const timing = panelSchema.pick({
  id: true,
  shotId: true,
  startFrame: true,
  durationFrames: true,
  width: true,
  height: true,
  revision: true,
  transition: true,
});

/** Read panel metadata only; the owner supplies a single consistent SQLite snapshot. */
export function queryBoardPanels(
  db: DatabaseSync,
  limit: number,
  offset: number,
  expected: number | undefined,
  readHeader: () => Header,
) {
  const indexed = catalogCurrent(db);
  const metadata = indexed ? readCatalogMetadata(db) : readHeader();
  if (expected !== undefined && expected !== metadata.version)
    throw new CodeboardError("REVISION_CONFLICT", "Project version changed; restart the query", {
      details: { expected, actual: metadata.version },
    });
  const totals = db
    .prepare(`SELECT COUNT(*) AS count,
    COALESCE(MAX(json_extract(info,'$.startFrame') + json_extract(info,'$.durationFrames')),0) AS duration
    FROM panels`)
    .get()!;
  const panelCount = Number(totals.count),
    durationFrames = Number(totals.duration);
  if (
    !Number.isSafeInteger(panelCount) ||
    panelCount < 0 ||
    !Number.isSafeInteger(durationFrames) ||
    durationFrames < 0
  )
    throw new CodeboardError("OPERATION_FAILED", "Stored board timing exceeds safe limits");
  const rows = db
    .prepare(`SELECT id,
    json_extract(info,'$.id') AS infoId,
    json_extract(info,'$.shotId') AS shotId,
    json_extract(info,'$.startFrame') AS startFrame,
    json_extract(info,'$.durationFrames') AS durationFrames,
    json_extract(info,'$.width') AS width,
    json_extract(info,'$.height') AS height,
    json_extract(info,'$.revision') AS revision,
    json_extract(info,'$.transition.type') AS transitionType,
    json_extract(info,'$.transition.durationFrames') AS transitionDuration
    FROM panels ORDER BY json_extract(info,'$.startFrame'),position LIMIT ? OFFSET ?`)
    .all(limit, offset);
  const items = rows.map((row) => {
    if (row.id !== row.infoId)
      throw new CodeboardError(
        "OPERATION_FAILED",
        "Stored panel identity differs from timing metadata",
      );
    const value = timing.parse({
      id: row.id,
      shotId: row.shotId,
      startFrame: row.startFrame,
      durationFrames: row.durationFrames,
      width: row.width,
      height: row.height,
      revision: row.revision,
      transition: { type: row.transitionType, durationFrames: row.transitionDuration },
    });
    if (
      ![
        value.startFrame,
        value.durationFrames,
        value.startFrame + value.durationFrames,
        value.revision,
      ].every(Number.isSafeInteger)
    )
      throw new CodeboardError("OPERATION_FAILED", "Stored panel timing exceeds safe limits");
    return value;
  });
  return boundQueryResponse(
    {
      version: metadata.version,
      indexed,
      frameRate: metadata.frameRate,
      durationFrames,
      panelCount,
      items,
    },
    "Stored board response",
  );
}
