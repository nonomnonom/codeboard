import { pageBounds } from "../model/query.js";
import { CodeboardError } from "../model/errors.js";
import { z } from "zod";
import { createHash } from "node:crypto";
import { findObjects, objectQuerySchema, boundObjectPage } from "../model/inspection/objects.js";
import type {
  ObjectQuery,
  ObjectPageQuery,
  ObjectPage,
  StoryboardDocument,
} from "../model/types.js";

export {
  objectEntries,
  findObjects,
  objectQuerySchema,
  boundObjectPage,
  projectSummarySchema,
  summarizeProject,
} from "../model/inspection.js";

const pageQuerySchema = objectQuerySchema
  .omit({ offset: true })
  .extend({ cursor: z.string().max(4096).optional() });
const cursorSchema = z
  .object({ snapshot: z.string(), filter: z.string(), offset: z.number().int().nonnegative() })
  .strict();

export function queryObjects(
  document: StoryboardDocument,
  input: ObjectPageQuery,
  snapshot: string,
): ObjectPage {
  const parsed = pageQuerySchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid object query", {
      details: { issues: parsed.error.issues },
    });
  const { cursor, ...values } = parsed.data;
  const query = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as ObjectQuery;
  const { limit } = pageBounds(query);
  const filter = createHash("sha256")
    .update(
      JSON.stringify([
        query.id ?? null,
        query.parentId ?? null,
        query.panelId ?? null,
        query.kind ?? null,
        query.name?.toLowerCase() ?? null,
      ]),
    )
    .digest("hex");
  let offset = 0;
  if (cursor !== undefined) {
    let data: z.infer<typeof cursorSchema>;
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid base64url");
      data = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    } catch (cause) {
      throw new CodeboardError("INVALID_CURSOR", "Invalid query cursor", { cause });
    }
    if (data.snapshot !== snapshot)
      throw new CodeboardError(
        "STALE_CURSOR",
        "Query cursor belongs to a different project session or edit state; restart the query",
      );
    if (data.filter !== filter)
      throw new CodeboardError("INVALID_CURSOR", "Query cursor filters differ; restart the query");
    offset = data.offset;
  }
  const items = findObjects(document, { ...query, limit, offset });
  const nextOffset = offset + items.length;
  const hasMore =
    items.length === limit &&
    findObjects(document, { ...query, limit: 1, offset: nextOffset }).length > 0;
  return boundObjectPage({
    version: document.version,
    items,
    ...(hasMore
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({ snapshot, filter, offset: nextOffset }),
          ).toString("base64url"),
        }
      : {}),
  });
}

export function inspectProject(document: StoryboardDocument) {
  return structuredClone({
    schemaVersion: document.schemaVersion,
    version: document.version,
    frameRate: document.frameRate,
    durationFrames: document.panels.reduce(
      (maximum, panel) => Math.max(maximum, panel.startFrame + panel.durationFrames),
      0,
    ),
    scenes: document.scenes.map((scene) => ({
      ...scene,
      shots: scene.shotIds.map((id) => document.shots.find((shot) => shot.id === id)),
    })),
    sequences: document.sequences,
    assets: document.assets,
    audioTracks: document.audioTracks,
    locks: document.locks,
    openComments: document.comments.filter((comment) => comment.status === "open"),
    capabilities: {
      vectorFill: "solid-linear-radial-local-coordinates",
      rasterPainting: "working",
      vectorStrokeEditing: "working",
      vectorBooleans: "closed-contours-skia",
      vectorStrokeOutlining: "explicit-editable-contour-conversion",
      pixelRegionEditing: "rgba8-source-rectangles",
      pixelSelections: "polygon-color-flood-combination-gaussian-feather",
      pixelFill: "source-over-copy-destination-out-source-atop",
      timeline: "working",
      camera2d: "independent-property-keys-and-easing",
      layerAnimation: "independent-property-keys-and-easing",
      animationEasing: "linear-smoothstep-hold-bounded-cubic-bezier",
      layerPivots: "permanent-local-joints",
      twoBoneIK: "stored-cutout-rig-baked-rotation-keys",
      drawingSequences: "reusable-drawings-holds-blanks",
      audioPlacement: "working",
      multiplane: "independent-root-depth-keys-2d-parallax",
      audioMixdown: "ffmpeg",
      audioInspection: "paged-tracks-clips-and-frame-filter",
      animaticFrameExport: "working",
      movieExport: "ffmpeg",
      referenceAssets: "partial",
      onionSkin: "layer-selection-tint-frame-samples",
      coordinateInspection: "animated-local-frame-matrices",
      renderComparison: "premultiplied-pixel-deltas",
      compositionGuides: "frame-space-review-overlay",
      reviewLocks: "working",
    },
  } as const);
}
