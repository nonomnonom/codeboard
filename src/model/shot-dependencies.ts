import type { Layer, StoryboardDocument } from "./types.js";
import { iterateLayers } from "./layers.js";
import { fingerprint } from "./value-fingerprint.js";
import { CodeboardError } from "./errors.js";

export interface ShotDependency {
  kind: "component" | "origin" | "palette" | "swatch" | "asset" | "font";
  id: string;
  status: "embedded" | "declared" | "missing";
  sha256: string | null;
  version?: number;
  paletteId?: string;
  source?: "linked" | "managed";
  checksum?: string | null;
}

/** Inspect a validated document's shot resource closure without filesystem or renderer probes. */
export function collectShotDependencies(document: StoryboardDocument, animationId: string) {
  const animation = document.studio.animations.find((entry) => entry.id === animationId);
  if (!animation) throw new CodeboardError("INVALID_ARGUMENT", "Shot animation not found");
  const entries = new Map<string, ShotDependency>();
  const insert = (entry: ShotDependency) => entries.set(`${entry.kind}:${entry.id}`, entry);
  const components = new Map(document.components.map((entry) => [entry.id, entry]));
  const origins = new Map(
    (document.studio.componentOrigins ?? []).map((entry) => [entry.instanceId, entry]),
  );
  const swatches = new Map(
    (document.studio.palettes ?? []).flatMap((palette) =>
      palette.swatches.map((swatch) => [swatch.id, { palette, swatch }] as const),
    ),
  );
  const pending: { layers: Layer[]; live: boolean }[] = [{ layers: animation.layers, live: true }];
  const visitedComponents = new Set<string>();
  const visitedOrigins = new Set<string>();
  while (pending.length) {
    const scope = pending.pop()!;
    for (const layer of iterateLayers(scope.layers)) {
      const source = layer.componentSource;
      if (source && !visitedComponents.has(source.id)) {
        visitedComponents.add(source.id);
        const component = components.get(source.id);
        insert({
          kind: "component",
          id: source.id,
          status: component ? "embedded" : "missing",
          sha256: component ? fingerprint(component) : null,
          ...(component ? { version: component.version } : {}),
        });
        if (component) pending.push({ layers: component.layers, live: false });
      }
      const origin = scope.live ? origins.get(layer.id) : undefined;
      if (origin && !visitedOrigins.has(origin.instanceId)) {
        visitedOrigins.add(origin.instanceId);
        insert({
          kind: "origin",
          id: origin.instanceId,
          status: "embedded",
          sha256: origin.sha256,
          version: origin.version,
        });
        pending.push({ layers: origin.source, live: false });
      }
      if (layer.kind === "group") continue;
      for (const element of layer.elements) {
        if (element.kind === "text")
          insert({ kind: "font", id: element.font, status: "declared", sha256: null });
        for (const binding of Object.values(element.colorBindings ?? {})) {
          if (!binding) continue;
          const found = swatches.get(binding.swatchId);
          insert({
            kind: "swatch",
            id: binding.swatchId,
            status: found ? "embedded" : "missing",
            sha256: found ? fingerprint(found.swatch) : null,
            ...(found ? { paletteId: found.palette.id } : {}),
          });
          if (found && !entries.has(`palette:${found.palette.id}`))
            insert({
              kind: "palette",
              id: found.palette.id,
              status: "embedded",
              sha256: fingerprint(found.palette),
            });
        }
      }
    }
  }
  for (const track of animation.audio ?? [])
    for (const clip of track.clips) {
      if (entries.has(`asset:${clip.assetId}`)) continue;
      const asset = document.assets.find((entry) => entry.id === clip.assetId);
      insert({
        kind: "asset",
        id: clip.assetId,
        status: asset ? "declared" : "missing",
        sha256: asset ? fingerprint(asset) : null,
        ...(asset ? { source: asset.source, checksum: asset.checksum ?? null } : {}),
      });
    }
  const items = [...entries.values()].sort((a, b) =>
    a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return { items, dependencyHash: fingerprint(items) };
}
