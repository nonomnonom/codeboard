import type { ComponentOrigin } from "./types/component-origins.js";
import type { StoryboardDocument } from "./types.js";
import { fingerprint } from "./value-fingerprint.js";
import { iterateLayers, type cloneLayersWithIdentities } from "./layers.js";
import { validateArtwork } from "./validation/artwork.js";
import { CodeboardError } from "./errors.js";

const payload = (origin: ComponentOrigin) => ({
  instanceId: origin.instanceId,
  componentId: origin.componentId,
  version: origin.version,
  source: origin.source,
  identities: origin.identities,
});

export function recordComponentOrigin(
  document: StoryboardDocument,
  input: Omit<ComponentOrigin, "sha256">,
): void {
  const origin = { ...structuredClone(input), sha256: "" };
  origin.sha256 = fingerprint(payload(origin));
  // Panel-scoped mutations share untouched studio branches with the undo snapshot.
  const origins = [...(document.studio.componentOrigins ?? [])];
  const index = origins.findIndex((entry) => entry.instanceId === origin.instanceId);
  if (index < 0) origins.push(origin);
  else origins[index] = origin;
  document.studio = { ...document.studio, componentOrigins: origins };
}

export function validateComponentOrigins(origins: readonly ComponentOrigin[]): void {
  const instances = new Set<string>();
  for (const origin of origins) {
    if (instances.has(origin.instanceId) || fingerprint(payload(origin)) !== origin.sha256)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Component origin identity or checksum is invalid",
        {
          details: { reason: "COMPONENT_ORIGIN_CHECKSUM", instanceId: origin.instanceId },
        },
      );
    instances.add(origin.instanceId);
    validateArtwork(origin.source);
    const ids: string[] = [];
    for (const layer of iterateLayers(origin.source)) {
      ids.push(layer.id, ...layer.keyframes.map((key) => key.id));
      if (layer.kind !== "group") ids.push(...layer.elements.map((element) => element.id));
    }
    const sourceIds = new Set(ids),
      mapped = new Set<string>(),
      copies = new Set<string>();
    for (const identity of origin.identities) {
      if (
        !sourceIds.has(identity.sourceId) ||
        mapped.has(identity.sourceId) ||
        copies.has(identity.copyId) ||
        sourceIds.has(identity.copyId)
      )
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Component origin requires a complete one-to-one clone mapping",
          {
            details: { reason: "COMPONENT_ORIGIN_MAPPING", instanceId: origin.instanceId },
          },
        );
      mapped.add(identity.sourceId);
      copies.add(identity.copyId);
    }
    if (sourceIds.size !== ids.length || mapped.size !== sourceIds.size)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Component origin source identities are incomplete or duplicated",
      );
  }
}

/** Carry a tracked instance's baseline through a real layer clone, retaining local deletions. */
export function copyComponentOrigins(
  document: StoryboardDocument,
  copied: ReturnType<typeof cloneLayersWithIdentities>,
  nextId: (prefix: string) => string,
): void {
  const mapping = new Map(copied.identities.map((entry) => [entry.sourceId, entry.copyId]));
  const layers = new Map([...iterateLayers(copied.layers)].map((layer) => [layer.id, layer]));
  const origins = [...(document.studio.componentOrigins ?? [])];
  const reserved = new Set([...mapping.keys(), ...mapping.values()]);
  for (const origin of origins) {
    reserved.add(origin.instanceId);
    for (const entry of origin.identities) {
      reserved.add(entry.sourceId);
      reserved.add(entry.copyId);
    }
  }
  for (const origin of origins) {
    const instanceId = mapping.get(origin.instanceId);
    if (!instanceId) continue;
    const instance = layers.get(instanceId);
    if (!instance?.componentSource) continue;
    if (
      instance.componentSource.id !== origin.componentId ||
      instance.componentSource.version !== origin.version
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Copied component origin does not match its instance",
        {
          details: { reason: "COMPONENT_ORIGIN_STALE", instanceId: origin.instanceId },
        },
      );
    const identities = origin.identities.map((entry) => {
      let copyId = mapping.get(entry.copyId);
      if (!copyId) {
        // A removed baseline object stays absent; reserve a new identity, not another instance's ID.
        copyId = nextId("component-origin");
        if (
          typeof copyId !== "string" ||
          !copyId.length ||
          copyId.length > 4096 ||
          reserved.has(copyId)
        )
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Component origin allocator must return a fresh ID",
          );
        reserved.add(copyId);
        mapping.set(entry.copyId, copyId);
      }
      return { sourceId: entry.sourceId, copyId };
    });
    recordComponentOrigin(document, {
      instanceId,
      componentId: origin.componentId,
      version: origin.version,
      source: origin.source,
      identities,
    });
  }
}
