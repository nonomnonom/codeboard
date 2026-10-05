import {
  applyComponentUpgrade,
  type ComponentUpgradeOptions,
} from "../../model/component-upgrade.js";
import type { Id, Transform, DrawingElement, Layer } from "../../model/types.js";
import { replaceComponentSource as replaceSource } from "../../model/component-source.js";
import {
  captureComponentArtwork,
  replaceComponentElementArtwork,
  reviseComponentArtwork,
  instantiateComponentArtwork,
  refreshComponentArtwork,
} from "../../model/components.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findLiveLayer } from "../../model/layers.js";
import { assertEditableTargets } from "../../model/locks.js";

type Host = Pick<ProductionHost, "_applyProduction">;

export function captureComponent(
  host: Host,
  layerId: Id,
  name: string,
  options: MutationOptions & { id?: Id } = {},
): Id {
  let id = "";
  host._applyProduction(
    "capture drawing component",
    [layerId],
    options.expectedVersion,
    (d, next) => {
      id = captureComponentArtwork(d, layerId, name, next, options.id);
    },
  );
  return id;
}

export function reviseComponent(
  host: Host,
  id: Id,
  sourceLayerId: Id,
  options: MutationOptions = {},
) {
  host._applyProduction("revise component source", [id], options.expectedVersion, (d, next) => {
    reviseComponentArtwork(d, id, sourceLayerId, next);
  });
}

export function instantiateComponent(
  host: Host,
  componentId: Id,
  panelId: Id,
  transform: Partial<Transform> = {},
  options: MutationOptions & { id?: Id } = {},
): Id {
  let id = "";
  host._applyProduction(
    "instantiate component",
    [panelId, componentId],
    options.expectedVersion,
    (d, next) => {
      id = instantiateComponentArtwork(d, componentId, panelId, transform, next, options.id);
    },
    { panelId },
  );
  return id;
}

export function refreshComponentInstance(
  host: Host,
  layerId: Id,
  options: MutationOptions & { comments?: "reject" | "anchor-to-instance" } = {},
) {
  if (
    options.comments !== undefined &&
    !["reject", "anchor-to-instance"].includes(options.comments)
  )
    throw new Error("Invalid component refresh comment policy");
  host._applyProduction(
    "explicitly refresh component instance",
    [layerId],
    options.expectedVersion,
    (d, next) => refreshComponentArtwork(d, layerId, next, options.comments),
    { layerId },
  );
}

export { assertStaticComponent } from "../../model/components.js";

export function replaceComponentElement(
  host: Host,
  componentId: Id,
  layerId: Id,
  element: DrawingElement,
  options: MutationOptions & { expectedComponentVersion: number },
) {
  host._applyProduction(
    "replace component source element",
    [componentId, layerId, element.id],
    options.expectedVersion,
    (document) =>
      replaceComponentElementArtwork(
        document,
        componentId,
        layerId,
        element,
        options.expectedComponentVersion,
      ),
  );
}

export function replaceComponentSource(
  host: Host,
  componentId: Id,
  layers: readonly Layer[],
  options: MutationOptions & { expectedComponentVersion: number },
) {
  host._applyProduction(
    "replace component source tree",
    [componentId],
    options.expectedVersion,
    (document) => replaceSource(document, componentId, layers, options.expectedComponentVersion),
  );
}

export function upgradeComponentInstance(
  host: Host & Pick<ProductionHost, "actor">,
  instanceId: Id,
  options: ComponentUpgradeOptions & MutationOptions & { expectedInputHash: string },
) {
  const { expectedVersion, ...upgradeOptions } = options;
  host._applyProduction(
    "upgrade component preserving overrides",
    [instanceId],
    expectedVersion,
    (document) => {
      const location = findLiveLayer(document, instanceId);
      assertEditableTargets(document.locks, host.actor, [location.owner.id, instanceId]);
      applyComponentUpgrade(document, instanceId, upgradeOptions);
    },
  );
}
