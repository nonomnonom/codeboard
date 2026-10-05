import { CodeboardError } from "../errors.js";

export function validateKeyframePositions(
  items: readonly { frame: number }[],
  owner: string,
): void {
  if (new Set(items.map((key) => key.frame)).size !== items.length)
    throw new CodeboardError("INVALID_ARGUMENT", `Duplicate keyframe position in ${owner}`, {
      details: { ownerId: owner },
    });
}
