import type { StoryboardDocument } from "../../model/types.js";
import type {
  CharacterInstanceOptions,
  CharacterInstanceResult,
} from "../../model/types/characters.js";
import { instantiateCharacterArtwork } from "../../animation/character.js";
import { copyComponentOrigins } from "../../model/component-origins.js";
import { CodeboardError } from "../../model/errors.js";

export function instantiateShotCharacter(
  document: StoryboardDocument,
  nextId: (prefix: string) => string,
  sourceAnimationId: string,
  options: CharacterInstanceOptions,
): CharacterInstanceResult {
  const source = document.studio.animations.find((entry) => entry.id === sourceAnimationId);
  const index = document.studio.animations.findIndex(
    (entry) => entry.id === options.targetAnimationId,
  );
  if (!source || index < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Character source and target animations must exist",
    );
  const { animation, copied } = instantiateCharacterArtwork(
    source,
    document.studio.animations[index]!,
    options,
    nextId,
  );
  document.studio.animations[index] = animation;
  copyComponentOrigins(document, copied, nextId);
  return {
    instanceId: options.id,
    sourceAnimationId,
    targetAnimationId: options.targetAnimationId,
    sourceRootLayerId: options.rootLayerId,
    identities: copied.identities,
  };
}
