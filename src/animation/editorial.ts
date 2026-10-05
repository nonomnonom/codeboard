import { defineShotAnimation } from "./shot.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence, ResolvedEditorialFrame } from "../model/types/editorial.js";
import { editorialSequenceSchema } from "../model/schema/editorial.js";
import { rescaleTime, createTimeMapper } from "./rational-time.js";
import { CodeboardError } from "../model/errors.js";

export { defineShotAnimation } from "./shot.js";

export function defineEditorialSequence(
  input: unknown,
  animations: readonly ShotAnimation[],
): EditorialSequence {
  return prepareEditorial(input, animations).sequence;
}

/** Internal snapshot preparation shared by resolution and rendering. */
export function prepareEditorial(input: unknown, animations: readonly ShotAnimation[]) {
  const parsed = editorialSequenceSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid editorial sequence", {
      details: { issues: parsed.error.issues },
    });
  const sequence = parsed.data as EditorialSequence;
  const sources = new Map(
    animations.map((input) => {
      const animation = defineShotAnimation(input);
      return [animation.id, animation] as const;
    }),
  );
  if (sources.size !== animations.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Animation library contains duplicate IDs");
  const ids = new Set<string>([sequence.id]);
  for (const track of sequence.audio ?? [])
    for (const id of [track.id, ...track.clips.map((clip) => clip.id)]) {
      if (ids.has(id))
        throw new CodeboardError("INVALID_ARGUMENT", `Duplicate editorial ID: ${id}`);
      ids.add(id);
    }
  for (const [index, clip] of sequence.clips.entries()) {
    if (ids.has(clip.id))
      throw new CodeboardError("INVALID_ARGUMENT", `Duplicate editorial ID: ${clip.id}`);
    ids.add(clip.id);
    const source = sources.get(clip.animationId);
    if (!source)
      throw new CodeboardError("INVALID_ARGUMENT", `Missing shot animation: ${clip.animationId}`);
    const end = clip.startFrame + clip.durationFrames;
    if (!Number.isSafeInteger(end))
      throw new CodeboardError("RESOURCE_LIMIT", "Editorial clip end exceeds the safe frame range");
    const hold = clip.holdFrames ?? 0;
    if (hold > clip.durationFrames)
      throw new CodeboardError("INVALID_ARGUMENT", "Editorial hold exceeds clip duration", {
        details: { clipId: clip.id, holdFrames: hold, durationFrames: clip.durationFrames },
      });
    const last =
      clip.sourceInFrame +
      rescaleTime(
        Math.max(0, clip.durationFrames - 1 - hold),
        sequence.frameRate,
        source.frameRate,
        "floor",
      ).value;
    if (!Number.isSafeInteger(last) || last >= source.durationFrames)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        `Editorial clip exceeds source animation: ${clip.id}`,
      );
    const transition = clip.transition;
    if (
      (transition.type === "cut" && transition.durationFrames !== 0) ||
      (transition.type !== "cut" && transition.durationFrames <= 0)
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        `Transition type and duration disagree: ${clip.id}`,
      );
    if (transition.durationFrames >= clip.durationFrames)
      throw new CodeboardError("INVALID_ARGUMENT", `Transition consumes clip: ${clip.id}`);
    const previous = sequence.clips[index - 1];
    const start = previous
      ? previous.startFrame + previous.durationFrames - previous.transition.durationFrames
      : 0;
    if (clip.startFrame !== start)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        `Editorial clip ${clip.id} must start at ${start}`,
      );
    if (previous && previous.transition.durationFrames >= clip.durationFrames)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        `Incoming clip is shorter than its overlap: ${clip.id}`,
      );
    const beforePrevious = sequence.clips[index - 2];
    if (
      beforePrevious &&
      clip.startFrame < beforePrevious.startFrame + beforePrevious.durationFrames
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Editorial timeline cannot overlap three clips");
    if (index === sequence.clips.length - 1 && transition.type !== "cut")
      throw new CodeboardError("INVALID_ARGUMENT", "Last editorial clip must end with a cut");
  }
  const mappers = new Map(
    sequence.clips.map((clip) => [
      clip.id,
      createTimeMapper(sequence.frameRate, sources.get(clip.animationId)!.frameRate, "floor"),
    ]),
  );
  const last = sequence.clips[sequence.clips.length - 1]!;
  const durationFrames = last.startFrame + last.durationFrames;
  const resolve = (frame: number): ResolvedEditorialFrame => {
    if (!Number.isSafeInteger(frame) || frame < 0 || frame >= durationFrames)
      throw new CodeboardError("INVALID_ARGUMENT", "Editorial frame is outside its duration");
    let low = 0,
      high = sequence.clips.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (sequence.clips[middle]!.startFrame <= frame) low = middle + 1;
      else high = middle;
    }
    const latest = sequence.clips[low - 1]!,
      previous = sequence.clips[low - 2];
    const overlapping =
      previous !== undefined && frame < previous.startFrame + previous.durationFrames;
    const outgoing = overlapping ? previous : latest,
      incoming = overlapping ? latest : undefined;
    const source = (clip: typeof outgoing) => ({
      clipId: clip.id,
      animationId: clip.animationId,
      sourceFrame:
        clip.sourceInFrame +
        mappers.get(clip.id)!(Math.max(0, frame - clip.startFrame - (clip.holdFrames ?? 0))).value,
    });
    return {
      frame,
      outgoing: source(outgoing),
      ...(incoming ? { incoming: source(incoming) } : {}),
      transition: incoming ? outgoing.transition.type : "cut",
      progress: incoming
        ? (frame - incoming.startFrame + 1) / outgoing.transition.durationFrames
        : 0,
    };
  };
  return { sequence, sources, durationFrames, resolve };
}

export function resolveEditorialFrame(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  frame: number,
): ResolvedEditorialFrame {
  return createEditorialResolver(sequence, animations).resolve(frame);
}

/** Validate and copy inputs once; returned frame mappings never expose the snapshot. */
export function createEditorialResolver(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
) {
  const prepared = prepareEditorial(sequence, animations);
  return {
    durationFrames: prepared.durationFrames,
    frameRate: { ...prepared.sequence.frameRate },
    resolve: prepared.resolve,
  };
}
