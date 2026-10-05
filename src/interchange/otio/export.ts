import { defineEditorialSequence } from "../../animation/editorial.js";
import { rescaleTime, type RationalRate } from "../../animation/rational-time.js";
import type { ShotAnimation } from "../../model/types/shot.js";
import type { EditorialSequence } from "../../model/types/editorial.js";
import { context, invalid, jsonSize, type OTIOOptions, type OTIOLoss } from "./contract.js";

const time = (value: number, rate: RationalRate) => ({
  OTIO_SCHEMA: "RationalTime.1",
  value,
  rate: rate.numerator / rate.denominator,
});

/** Export a single video cut list. Media bindings describe already-rendered media, not artwork. */
export function exportOTIO(
  input: EditorialSequence,
  animations: readonly ShotAnimation[],
  options: OTIOOptions,
): { json: string; losses: OTIOLoss[] } {
  const sequence = defineEditorialSequence(input, animations);
  if (sequence.clips.length > 1000) invalid("/clips", "Maximum 1000 clips");
  const ctx = context(options, animations);
  if (sequence.audio?.length) ctx.lose("/audio", "Editorial audio tracks are not exported");
  const visited = new Set<string>();
  const children = sequence.clips.map((clip, index) => {
    if (clip.transition.type !== "cut")
      invalid(`/clips/${index}/transition`, "Only cuts are supported");
    if (clip.holdFrames)
      invalid(
        `/clips/${index}/holdFrames`,
        "Initial picture holds require baked media and a new explicit binding",
      );
    const binding = ctx.byId.get(clip.animationId);
    if (!binding) invalid(`/clips/${index}/animationId`, "No explicit media binding");
    const source = ctx.sources.get(clip.animationId)!;
    if (source.audio?.length && !visited.has(source.id))
      ctx.lose(
        `/animations/${source.id.replaceAll("~", "~0").replaceAll("/", "~1")}/audio`,
        "Shot audio tracks are not exported",
      );
    visited.add(source.id);
    const start = binding.sourceStartFrame + clip.sourceInFrame;
    const span = rescaleTime(
      clip.durationFrames,
      sequence.frameRate,
      source.frameRate,
      "ceil",
    ).value;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(binding.sourceStartFrame + source.durationFrames) ||
      clip.sourceInFrame + span > source.durationFrames
    )
      invalid(`/clips/${index}`, "Source range exceeds media duration or safe frame limits");
    return {
      OTIO_SCHEMA: "Clip.2",
      name: clip.id,
      metadata: { codeboard: { clipId: clip.id } },
      enabled: true,
      effects: [],
      markers: [],
      source_range: {
        OTIO_SCHEMA: "TimeRange.1",
        start_time: time(start, source.frameRate),
        duration: time(clip.durationFrames, sequence.frameRate),
      },
      active_media_reference_key: "DEFAULT_MEDIA",
      media_references: {
        DEFAULT_MEDIA: {
          OTIO_SCHEMA: "ExternalReference.1",
          name: "",
          metadata: {},
          target_url: binding.targetUrl,
          available_range: {
            OTIO_SCHEMA: "TimeRange.1",
            start_time: time(binding.sourceStartFrame, source.frameRate),
            duration: time(source.durationFrames, source.frameRate),
          },
        },
      },
    };
  });
  const json = JSON.stringify(
    {
      OTIO_SCHEMA: "Timeline.1",
      name: sequence.id,
      metadata: {},
      global_start_time: null,
      tracks: {
        OTIO_SCHEMA: "Stack.1",
        name: "",
        metadata: {},
        enabled: true,
        effects: [],
        markers: [],
        source_range: null,
        children: [
          {
            OTIO_SCHEMA: "Track.1",
            kind: "Video",
            name: "",
            metadata: {},
            enabled: true,
            effects: [],
            markers: [],
            source_range: null,
            children,
          },
        ],
      },
    },
    null,
    2,
  );
  jsonSize(json);
  return { json, losses: ctx.finish() };
}
