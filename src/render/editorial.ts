import type { Canvas } from "skia-canvas";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import { prepareEditorial } from "../animation/editorial.js";
import { CodeboardError } from "../model/errors.js";
import { createShotRenderSession } from "./shot.js";
import { compositeTransition } from "./transition.js";
import { encodePNG } from "./png.js";

export { createShotRenderSession, renderShotFramePNG } from "./shot.js";

export function createEditorialRenderSession(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
) {
  const prepared = prepareEditorial(sequence, animations);
  for (const [index, clip] of prepared.sequence.clips.entries()) {
    if (clip.transition.type === "cut") continue;
    const next = prepared.sequence.clips[index + 1]!;
    const current = prepared.sources.get(clip.animationId)!.canvas,
      incoming = prepared.sources.get(next.animationId)!.canvas;
    if (current.width !== incoming.width || current.height !== incoming.height)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Editorial transition requires matching source canvas dimensions",
      );
  }
  const sessions = new Map<string, ReturnType<typeof createShotRenderSession>>();
  const shotFrame = (animationId: string, position: number): Canvas => {
    let session = sessions.get(animationId);
    if (!session) {
      session = createShotRenderSession(prepared.sources.get(animationId)!);
      sessions.set(animationId, session);
    }
    return session.frame(position);
  };
  const frame = (position: number): Canvas => {
    const resolved = prepared.resolve(position);
    const current = shotFrame(resolved.outgoing.animationId, resolved.outgoing.sourceFrame);
    if (!resolved.incoming) return current;
    let incoming: Canvas | undefined;
    try {
      incoming = shotFrame(resolved.incoming.animationId, resolved.incoming.sourceFrame);
      return compositeTransition(current, incoming, resolved.transition, resolved.progress);
    } finally {
      incoming?.getContext("2d").reset();
      current.getContext("2d").reset();
    }
  };
  return {
    durationFrames: prepared.durationFrames,
    frameRate: { ...prepared.sequence.frameRate },
    resolve: prepared.resolve,
    frame,
    png: (position: number) => encodePNG(frame(position)),
  };
}

export async function renderEditorialFramePNG(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  frame: number,
): Promise<Buffer> {
  return createEditorialRenderSession(sequence, animations).png(frame);
}
