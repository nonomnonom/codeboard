import { isDeepStrictEqual } from "node:util";
import { allLayers } from "./layers.js";
import type { Id, ProjectLock, StoryboardDocument } from "./types.js";

export function assertEditableTargets(
  locks: readonly ProjectLock[],
  actor: string,
  targetIds: readonly Id[],
): void {
  const blocking = locks.find(
    (lock) =>
      lock.owner !== actor && (lock.targetType === "project" || targetIds.includes(lock.targetId)),
  );
  if (blocking) throw new Error(`Locked by ${blocking.owner}: ${blocking.reason}`);
}

export function assertLocksUnchanged(
  before: StoryboardDocument,
  after: StoryboardDocument,
  actor: string,
): void {
  for (const lock of before.locks.filter((entry) => entry.owner !== actor)) {
    const target = (document: StoryboardDocument) => {
      if (lock.targetType === "project") return document;
      if (lock.targetType === "panel")
        return document.panels.find((panel) => panel.id === lock.targetId);
      for (const owner of [
        ...document.panels,
        ...document.components,
        ...document.studio.animations,
      ]) {
        const layer = allLayers(owner.layers).find((entry) => entry.id === lock.targetId);
        if (!layer) continue;
        const owned = new Set(allLayers([layer]).map((entry) => entry.id));
        const meshes = ("meshes" in owner ? (owner.meshes ?? []) : [])
          .filter((binding) => owned.has(binding.layerId))
          .sort((a, b) => (a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0));
        const controllers = ("controllers" in owner ? (owner.controllers ?? []) : []).filter(
          (controller) => controller.targets.some((target) => owned.has(target.layerId)),
        );
        const origins = (document.studio.componentOrigins ?? []).filter((origin) =>
          owned.has(origin.instanceId),
        );
        return { layer, meshes, controllers, origins };
      }
      return undefined;
    };
    if (!isDeepStrictEqual(target(before), target(after)))
      throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
  }
}

export function assertRemovalUnlocked(
  document: Pick<StoryboardDocument, "locks">,
  removedIds: ReadonlySet<Id>,
): void {
  const lock = document.locks.find((entry) => removedIds.has(entry.targetId));
  if (lock)
    throw new Error(
      `Cannot remove locked artwork: unlock ${lock.targetType} ${lock.targetId} first (${lock.id})`,
    );
}
