import type { ShotAnimation } from "../model/types/shot.js";
import { cloneLayersWithIdentities } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";

/** Clone layer-owned rig, deformation and controller identities as one dependency boundary. */
export function cloneShotArtwork(
  source: Pick<ShotAnimation, "layers" | "meshes" | "controllers">,
  nextId: (prefix: string) => string,
) {
  const copied = cloneLayersWithIdentities(source.layers, nextId);
  const mapping = new Map(copied.identities.map((entry) => [entry.sourceId, entry.copyId]));
  const layer = (id: string) => {
    const result = mapping.get(id);
    if (!result)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Copied artwork has an external layer dependency",
        { details: { reason: "CHARACTER_EXTERNAL_DEPENDENCY", sourceId: id } },
      );
    return result;
  };
  const meshes = source.meshes?.map((binding) => {
    const result = structuredClone(binding);
    result.layerId = layer(result.layerId);
    if (result.skin)
      result.skin.jointLayers = result.skin.jointLayers.map((joint) => ({
        ...joint,
        layerId: layer(joint.layerId),
      }));
    return result;
  });
  const controllers = source.controllers?.map((controller) => {
    const result = structuredClone(controller);
    result.id = nextId("controller");
    copied.identities.push({ sourceId: controller.id, copyId: result.id });
    result.targets = result.targets.map((target) => ({
      ...target,
      layerId: layer(target.layerId),
    }));
    return result;
  });
  return {
    ...copied,
    ...(meshes === undefined ? {} : { meshes }),
    ...(controllers === undefined ? {} : { controllers }),
  };
}
