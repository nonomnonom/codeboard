import type { StoryboardDocument, PageOptions, Layer } from "../../../model/types.js";
import { iterateLayers } from "../../../model/layers.js";
import { boundQueryResponse, pageBounds } from "../../../model/query.js";
import { CodeboardError } from "../../../model/errors.js";

function objectIds(layers: readonly Layer[]): Set<string> {
  const ids = new Set<string>();
  for (const layer of iterateLayers(layers)) {
    ids.add(layer.id);
    for (const key of layer.keyframes) ids.add(key.id);
    if (layer.kind !== "group") for (const element of layer.elements) ids.add(element.id);
  }
  return ids;
}

/** Inspect provenance metadata without copying baseline geometry or raster bytes. */
export function readComponentOrigin(
  document: StoryboardDocument,
  instanceId: string,
  options: PageOptions,
) {
  if (typeof instanceId !== "string" || !instanceId.length || instanceId.length > 4096)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid component instance ID");
  const { offset, limit } = pageBounds(options);
  const origin = document.studio.componentOrigins?.find((entry) => entry.instanceId === instanceId);
  if (!origin)
    throw new CodeboardError("INVALID_ARGUMENT", "Component instance has no retained origin", {
      details: { reason: "COMPONENT_ORIGIN_MISSING", instanceId },
    });
  const roots = [...document.panels, ...document.studio.animations].flatMap(
    (owner) => owner.layers,
  );
  const liveLayers = [...iterateLayers(roots)];
  const instance = liveLayers.find((layer) => layer.id === instanceId);
  const declared = instance?.componentSource;
  const state = !instance
    ? ("missing" as const)
    : !declared
      ? ("detached" as const)
      : declared.id === origin.componentId && declared.version === origin.version
        ? ("matching" as const)
        : ("stale" as const);
  const inside = instance?.kind === "group" ? objectIds(instance.children) : new Set<string>();
  const anywhere = objectIds(roots);
  const entries = origin.identities.slice(offset, offset + limit).map((entry) => ({
    ...entry,
    location: inside.has(entry.copyId)
      ? ("instance" as const)
      : anywhere.has(entry.copyId)
        ? ("elsewhere" as const)
        : ("missing" as const),
  }));
  return boundQueryResponse(
    {
      version: document.version,
      instanceId,
      componentId: origin.componentId,
      baselineVersion: origin.version,
      sha256: origin.sha256,
      instanceState: state,
      instanceSource: declared ? { ...declared } : null,
      libraryVersion:
        document.components.find((component) => component.id === origin.componentId)?.version ??
        null,
      offset,
      limit,
      total: origin.identities.length,
      nextOffset:
        offset + entries.length < origin.identities.length ? offset + entries.length : null,
      items: entries,
    },
    "Component origin page",
  );
}
