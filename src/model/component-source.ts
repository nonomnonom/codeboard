import { z } from "zod";
import type { Layer, StoryboardDocument } from "./types.js";
import { layer as layerSchema } from "./schema/layers.js";
import { iterateLayers } from "./layers.js";
import { validateArtwork } from "./validation/artwork.js";
import { CodeboardError } from "./errors.js";
import { fingerprint } from "./value-fingerprint.js";

/** Validate an explicitly identified static library tree without regenerating identities. */
export function defineComponentSource(input: unknown): Layer[] {
  fingerprint(input);
  const parsed = z.array(layerSchema).min(1).safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid component source tree", {
      details: { issues: parsed.error.issues },
    });
  const layers = structuredClone(parsed.data) as Layer[];
  validateArtwork(layers);
  const ids = new Set<string>();
  const insert = (id: string) => {
    if (!id || id.length > 4096 || ids.has(id))
      throw new CodeboardError("INVALID_ARGUMENT", "Component source IDs must be valid and unique");
    ids.add(id);
  };
  for (const layer of iterateLayers(layers)) {
    insert(layer.id);
    if (layer.keyframes.length || layer.exposure !== null || layer.componentSource !== undefined)
      throw new CodeboardError("INVALID_ARGUMENT", "Component source must be static and untracked");
    if (layer.kind === "group") {
      if (layer.drawingSequence !== undefined)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Component source cannot contain drawing timing",
        );
    } else {
      for (const element of layer.elements) {
        insert(element.id);
        if (element.kind === "raster-stroke" && element.reveal !== undefined)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Component source cannot contain timed reveal",
          );
      }
    }
  }
  return layers;
}

export function componentRevisionTarget(
  document: StoryboardDocument,
  componentId: string,
  expectedComponentVersion: number,
) {
  const component = document.components.find((entry) => entry.id === componentId);
  if (!component) throw new CodeboardError("INVALID_ARGUMENT", "Component not found");
  if (!Number.isSafeInteger(expectedComponentVersion) || expectedComponentVersion < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Expected component version must be a positive safe integer",
    );
  if (component.version !== expectedComponentVersion)
    throw new CodeboardError("REVISION_CONFLICT", "Component source version differs", {
      details: { componentId, expected: expectedComponentVersion, actual: component.version },
    });
  const version = component.version + 1;
  if (!Number.isSafeInteger(version))
    throw new CodeboardError("RESOURCE_LIMIT", "Component version exceeds the safe integer range");
  return { component, version };
}

export function replaceComponentSource(
  document: StoryboardDocument,
  componentId: string,
  input: readonly Layer[],
  expectedComponentVersion: number,
): void {
  const { component, version } = componentRevisionTarget(
    document,
    componentId,
    expectedComponentVersion,
  );
  const layers = defineComponentSource(input);
  component.layers = layers;
  component.version = version;
}
