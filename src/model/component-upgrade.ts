import { z } from "zod";
import type { StoryboardDocument, Layer } from "./types.js";
import { findLiveLayer, iterateLayers } from "./layers.js";
import { validateComponentOrigins, recordComponentOrigin } from "./component-origins.js";
import { fingerprint } from "./value-fingerprint.js";
import { mergeValueSnapshots, type ValueMergeOptions } from "./value-merge.js";
import { CodeboardError } from "./errors.js";
import { documentIdentityIds } from "./validation/document.js";

export interface ComponentUpgradeOptions extends ValueMergeOptions {
  newIdentities?: readonly { sourceId: string; copyId: string }[];
}
const id = z.string().min(1).max(4096);
const schema = z
  .object({
    newIdentities: z
      .array(z.object({ sourceId: id, copyId: id }).strict())
      .max(100000)
      .default([]),
    resolutions: z.record(z.string().max(16384), z.enum(["local", "incoming"])).optional(),
  })
  .strict();

/** Prepare an instance upgrade without changing artwork or allocating IDs. */
export function prepareComponentUpgrade(
  document: StoryboardDocument,
  instanceId: string,
  options: ComponentUpgradeOptions = {},
) {
  const parsed = schema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid component upgrade options");
  const location = findLiveLayer(document, instanceId);
  const { layer } = location;
  const owner = { kind: location.kind, id: location.owner.id };
  const origin = document.studio.componentOrigins?.find((entry) => entry.instanceId === instanceId);
  if (layer.kind !== "group" || !layer.componentSource || !origin)
    throw new CodeboardError("INVALID_ARGUMENT", "Upgrade requires a tracked component instance");
  validateComponentOrigins([origin]);
  if (
    layer.componentSource.id !== origin.componentId ||
    layer.componentSource.version !== origin.version
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Component origin is stale");
  const component = document.components.find((entry) => entry.id === origin.componentId);
  if (!component || component.version < origin.version)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Upgrade source is missing or older than the baseline",
    );
  const mapping = new Map(origin.identities.map((entry) => [entry.sourceId, entry.copyId]));
  const destinations = new Set(mapping.values());
  const reserved = new Set(documentIdentityIds(document));
  for (const retained of document.studio.componentOrigins ?? []) {
    reserved.add(retained.instanceId);
    for (const identity of retained.identities) reserved.add(identity.copyId);
  }
  const extra = new Set<string>();
  for (const entry of parsed.data.newIdentities) {
    if (mapping.has(entry.sourceId) || destinations.has(entry.copyId) || reserved.has(entry.copyId))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Upgrade identity mappings must be one-to-one and new",
        {
          details: {
            reason: "COMPONENT_UPGRADE_IDENTITY_COLLISION",
            sourceId: entry.sourceId,
            copyId: entry.copyId,
          },
        },
      );
    mapping.set(entry.sourceId, entry.copyId);
    destinations.add(entry.copyId);
    extra.add(entry.sourceId);
  }
  const incomingIds = new Set<string>();
  const remap = (source: Layer[], incoming: boolean): Layer[] => {
    const layers = structuredClone(source);
    const mapped = (sourceId: string) => {
      const result = mapping.get(sourceId);
      if (!result)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Upgrade needs explicit identities for new source objects",
          {
            details: { reason: "COMPONENT_UPGRADE_IDENTITY", sourceId },
          },
        );
      return result;
    };
    for (const entry of iterateLayers(layers)) {
      if (incoming) incomingIds.add(entry.id);
      entry.id = mapped(entry.id);
      if (entry.maskLayerId) entry.maskLayerId = mapped(entry.maskLayerId);
      for (const key of entry.keyframes) {
        if (incoming) incomingIds.add(key.id);
        key.id = mapped(key.id);
      }
      if (entry.kind === "group") {
        if (entry.twoBoneRig) entry.twoBoneRig.elbowId = mapped(entry.twoBoneRig.elbowId);
        for (const key of entry.drawingSequence ?? [])
          if (key.drawingId !== null) key.drawingId = mapped(key.drawingId);
      } else
        for (const element of entry.elements) {
          if (incoming) incomingIds.add(element.id);
          element.id = mapped(element.id);
        }
    }
    return layers;
  };
  const base = remap(origin.source, false),
    incoming = remap(component.layers, true);
  if ([...extra].some((sourceId) => !incomingIds.has(sourceId)))
    throw new CodeboardError("INVALID_ARGUMENT", "Upgrade has unused new identity mappings");
  const { value: layers, ...report } = mergeValueSnapshots(
    base,
    layer.children,
    incoming,
    parsed.data.resolutions === undefined ? {} : { resolutions: parsed.data.resolutions },
  );
  return {
    layers,
    report,
    source: component,
    identities: [...incomingIds].map((sourceId) => ({ sourceId, copyId: mapping.get(sourceId)! })),
    inputHash: fingerprint({
      owner,
      origin,
      local: layer.children,
      incoming: component,
      newIdentities: parsed.data.newIdentities,
    }),
    instanceId,
    owner,
  };
}

export function applyComponentUpgrade(
  document: StoryboardDocument,
  instanceId: string,
  options: ComponentUpgradeOptions & { expectedInputHash: string },
): void {
  const { expectedInputHash, ...mergeOptions } = options;
  if (!/^[a-f0-9]{64}$/.test(expectedInputHash))
    throw new CodeboardError("INVALID_ARGUMENT", "Upgrade requires the preview input hash");
  const prepared = prepareComponentUpgrade(document, instanceId, mergeOptions);
  if (prepared.inputHash !== expectedInputHash)
    throw new CodeboardError("REVISION_CONFLICT", "Component upgrade inputs changed", {
      details: { expected: expectedInputHash, actual: prepared.inputHash },
    });
  if (prepared.layers === null)
    throw new CodeboardError("REVISION_CONFLICT", "Component upgrade has unresolved conflicts", {
      details: { conflicts: prepared.report.conflicts },
    });
  const { layer } = findLiveLayer(document, instanceId);
  if (layer.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", "Upgrade instance is not a group");
  layer.children = prepared.layers;
  layer.componentSource = { id: prepared.source.id, version: prepared.source.version };
  recordComponentOrigin(document, {
    instanceId,
    componentId: prepared.source.id,
    version: prepared.source.version,
    source: prepared.source.layers,
    identities: prepared.identities,
  });
}
