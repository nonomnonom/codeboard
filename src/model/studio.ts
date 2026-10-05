import type { StoryboardDocument } from "./types.js";
import { CodeboardError } from "./errors.js";

export function findStudioAudioOwner(document: StoryboardDocument, id: string) {
  const owner =
    document.studio.animations.find((item) => item.id === id) ??
    document.studio.editorial.find((item) => item.id === id);
  if (!owner) throw new CodeboardError("INVALID_ARGUMENT", `Studio audio owner not found: ${id}`);
  return owner;
}
