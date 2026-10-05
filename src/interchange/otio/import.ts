import { defineEditorialSequence } from "../../animation/editorial.js";
import type { ShotAnimation } from "../../model/types/shot.js";
import type { EditorialSequence } from "../../model/types/editorial.js";
import {
  context,
  frame,
  importOptions,
  invalid,
  jsonSize,
  parse,
  type OTIOImportOptions,
  type OTIOLoss,
} from "./contract.js";
import {
  clipIdentitySchema,
  clipSchema,
  referenceSchema,
  timelineSchema,
  trackSchema,
} from "./schema.js";

/** Conform one cut-only video track to existing animations without reading external media. */
export function importOTIO(
  json: string,
  animations: readonly ShotAnimation[],
  options: OTIOImportOptions,
): { sequence: EditorialSequence; losses: OTIOLoss[] } {
  jsonSize(json);
  const settings = importOptions(options);
  const ctx = context({ media: settings.media, lossPolicy: settings.lossPolicy }, animations);
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    invalid("/", "Invalid JSON");
  }
  const timeline = parse(timelineSchema, input, "");
  const rates = [
    settings.frameRate,
    ...Array.from(ctx.sources.values(), (source) => source.frameRate),
  ];
  function annotations(
    value: {
      name: string;
      metadata: Record<string, unknown>;
      markers?: unknown[];
      color?: unknown;
    },
    path: string,
    retainedName = "",
    clipId?: string,
  ) {
    if (value.name && value.name !== retainedName)
      ctx.lose(`${path}/name`, "Display name is not retained");
    for (const key of Object.keys(value.metadata))
      if (key !== "codeboard" || clipId === undefined)
        ctx.lose(
          `${path}/metadata/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          "Metadata is not retained",
        );
    if (value.markers?.length) ctx.lose(`${path}/markers`, "Markers are not retained");
    if (value.color != null) ctx.lose(`${path}/color`, "Display color is not retained");
  }
  annotations(timeline, "", settings.sequenceId);
  if (timeline.global_start_time?.value)
    ctx.lose("/global_start_time", "Sequence origin becomes zero");
  annotations(timeline.tracks, "/tracks");
  const tracks = timeline.tracks.children.map((value, index) => ({
    track: parse(trackSchema, value, `/tracks/children/${index}`),
    path: `/tracks/children/${index}`,
  }));
  const video = tracks.filter(({ track }) => track.kind === "Video");
  if (video.length !== 1) invalid("/tracks/children", "Exactly one video track is required");
  for (const { track, path } of tracks) {
    if (track.kind === "Audio") ctx.lose(path, "Audio track is not imported");
    else annotations(track, path);
  }
  const { track, path } = video[0]!;
  if (!track.children.length) invalid(`${path}/children`, "Video track must contain clips");
  let startFrame = 0;
  const clips = track.children.map((value, index) => {
    const clipPath = `${path}/children/${index}`;
    const clip = parse(clipSchema, value, clipPath);
    const identity =
      clip.metadata.codeboard === undefined
        ? undefined
        : parse(clipIdentitySchema, clip.metadata.codeboard, `${clipPath}/metadata/codeboard`);
    const id = identity?.clipId ?? `${settings.sequenceId}:clip:${index}`;
    annotations(clip, clipPath, id, identity?.clipId);
    const referencePath =
      clip.OTIO_SCHEMA === "Clip.1"
        ? `${clipPath}/media_reference`
        : `${clipPath}/media_references/${clip.active_media_reference_key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (clip.OTIO_SCHEMA === "Clip.2" && Object.keys(clip.media_references).length > 1)
      ctx.lose(`${clipPath}/media_references`, "Inactive media references are not retained");
    const reference = parse(
      referenceSchema,
      clip.OTIO_SCHEMA === "Clip.1"
        ? clip.media_reference
        : clip.media_references[clip.active_media_reference_key],
      referencePath,
    );
    annotations(reference, referencePath);
    if (reference.available_image_bounds != null)
      ctx.lose(
        `${referencePath}/available_image_bounds`,
        "Image bounds use the mapped animation canvas",
      );
    const binding = ctx.byUrl.get(reference.target_url);
    if (!binding) invalid(`${referencePath}/target_url`, "No explicit media binding");
    const source = ctx.sources.get(binding.animationId)!;
    if (reference.available_range) {
      const available = reference.available_range;
      if (
        frame(
          available.start_time,
          source.frameRate,
          rates,
          `${referencePath}/available_range/start_time`,
        ) !== binding.sourceStartFrame ||
        frame(
          available.duration,
          source.frameRate,
          rates,
          `${referencePath}/available_range/duration`,
        ) !== source.durationFrames
      )
        invalid(
          `${referencePath}/available_range`,
          "Available range must match the mapped animation origin and duration",
        );
    }
    const sourceInFrame =
      frame(
        clip.source_range.start_time,
        source.frameRate,
        rates,
        `${clipPath}/source_range/start_time`,
      ) - binding.sourceStartFrame;
    const durationFrames = frame(
      clip.source_range.duration,
      settings.frameRate,
      rates,
      `${clipPath}/source_range/duration`,
    );
    const sourceSpan = frame(
      clip.source_range.duration,
      source.frameRate,
      rates,
      `${clipPath}/source_range/duration`,
      "ceil",
    );
    if (
      !Number.isSafeInteger(sourceInFrame) ||
      sourceInFrame < 0 ||
      sourceInFrame + sourceSpan > source.durationFrames
    )
      invalid(`${clipPath}/source_range`, "Trim is outside the mapped animation");
    const result = {
      id,
      animationId: source.id,
      startFrame,
      sourceInFrame,
      durationFrames,
      transition: { type: "cut" as const, durationFrames: 0 },
    };
    startFrame += durationFrames;
    return result;
  });
  const sequence = defineEditorialSequence(
    { id: settings.sequenceId, frameRate: settings.frameRate, clips },
    animations,
  );
  return { sequence, losses: ctx.finish() };
}
