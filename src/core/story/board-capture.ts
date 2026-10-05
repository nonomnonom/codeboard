import { z } from "zod";
import type { StoryboardProject } from "../project.js";
import type { EditCommand } from "../edit-plan/types.js";
import type { EditorialSequence } from "../../model/types/editorial.js";
import { normalizeRate, type TimeRounding } from "../../animation/rational-time.js";
import { CodeboardError } from "../../model/errors.js";
import { captureBoardAudio } from "./board-capture-audio.js";

export interface BoardCaptureOptions {
  sequenceId: string;
  panels: readonly { panelId: string; animationId: string; clipId: string }[];
  audio:
    | { mode: "omit" }
    | { mode: "convert"; sampleRates: Record<string, number>; rounding?: TimeRounding };
}
const id = z.string().min(1).max(4096);
const schema = z
  .object({
    sequenceId: id,
    panels: z
      .array(z.object({ panelId: id, animationId: id, clipId: id }).strict())
      .min(1)
      .max(999),
    audio: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("omit") }).strict(),
      z
        .object({
          mode: z.literal("convert"),
          sampleRates: z.record(id, z.number().int().positive().safe()),
          rounding: z.enum(["exact", "nearest", "floor", "ceil"]).default("exact"),
        })
        .strict(),
    ]),
  })
  .strict();

/** Capture every board panel and conform its frozen incoming transitions in one version-pinned plan. */
export function planBoardCapture(project: StoryboardProject, input: BoardCaptureOptions) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid board capture options", {
      details: { issues: parsed.error.issues },
    });
  const options = parsed.data,
    summary = project.production.summary();
  if (summary.counts.panels !== options.panels.length)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Board capture requires exactly one mapping for every panel",
    );
  const mappings = new Map(options.panels.map((mapping) => [mapping.panelId, mapping]));
  if (mappings.size !== options.panels.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Duplicate board panel mapping");
  const reserved = new Set<string>();
  const reserve = (value: string) => {
    if (
      !value ||
      value.length > 4096 ||
      reserved.has(value) ||
      project.production.query({ id: value, limit: 1 }).items.length
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Board capture requires unique new destination IDs",
        { details: { id: value } },
      );
    reserved.add(value);
  };
  reserve(options.sequenceId);
  const panels: ReturnType<StoryboardProject["boardPanels"]> = [];
  for (let offset = 0; offset < options.panels.length; offset += 200)
    panels.push(...project.boardPanels({ offset, limit: 200 }));
  const sequence: EditorialSequence = {
    id: options.sequenceId,
    frameRate: normalizeRate(summary.frameRate),
    clips: [],
  };
  const commands: EditCommand[] = [];
  let cursor = 0;
  for (const [index, panel] of panels.entries()) {
    const mapping = mappings.get(panel.id);
    if (!mapping || panel.startFrame !== cursor)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Board capture requires complete mappings and contiguous panel timing",
        { details: { panelId: panel.id } },
      );
    reserve(mapping.animationId);
    reserve(mapping.clipId);
    const hold = index ? panels[index - 1]!.transition.durationFrames : 0;
    if (
      hold &&
      (panels[index - 1]!.width !== panel.width || panels[index - 1]!.height !== panel.height)
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Board transition capture requires matching panel dimensions",
        { details: { panelId: panel.id } },
      );
    const last = index === panels.length - 1;
    if (last && panel.transition.type !== "cut")
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Remove the unused trailing board transition before capture",
        { details: { panelId: panel.id } },
      );
    commands.push({ op: "animation.capturePanel", panelId: panel.id, id: mapping.animationId });
    sequence.clips.push({
      id: mapping.clipId,
      animationId: mapping.animationId,
      startFrame: panel.startFrame - hold,
      sourceInFrame: 0,
      durationFrames: panel.durationFrames + hold,
      ...(hold ? { holdFrames: hold } : {}),
      transition: structuredClone(panel.transition),
    });
    cursor += panel.durationFrames;
  }
  const audio =
    options.audio.mode === "convert"
      ? captureBoardAudio(project, sequence.id, sequence.frameRate, options.audio, reserve)
      : null;
  if (audio) sequence.audio = audio.tracks;
  commands.push({ op: "editorial.put", sequence });
  return {
    plan: project.plan("Capture board as studio shots and editorial", commands),
    source: {
      projectId: summary.id,
      version: summary.version,
      durationFrames: summary.durationFrames,
    },
    sequenceId: sequence.id,
    panels: panels.map((panel) => ({
      ...mappings.get(panel.id)!,
      startFrame: panel.startFrame,
      durationFrames: panel.durationFrames,
      revision: panel.revision,
    })),
    audio: {
      mode: options.audio.mode,
      omittedTracks: audio ? 0 : summary.counts.audioTracks,
      mappings: audio?.mappings ?? [],
      quantizedPositions: audio?.quantizedPositions ?? 0,
    },
  };
}
