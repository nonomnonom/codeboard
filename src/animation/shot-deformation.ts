import type { ShotAnimation, ShotAnimationEdit } from "../model/types/shot.js";
import { prepareLayerSkinPoses } from "./layer-skin.js";
import { locateLayer } from "../model/layer-tree.js";
import { CodeboardError } from "../model/errors.js";

type DeformationEdit = Extract<
  ShotAnimationEdit,
  {
    op:
      | "layer.skin.bind.capture"
      | "layer.skin.weights.put"
      | "layer.skin"
      | "layer.mesh"
      | "layer.deformation.rest.apply"
      | "layer.envelope"
      | "layer.envelope.key.put"
      | "layer.envelope.key.remove"
      | "layer.curve"
      | "layer.mesh.key.put"
      | "layer.mesh.key.remove"
      | "layer.curve.key.put"
      | "layer.curve.key.remove";
  }
>;

function reviseFrame<T extends { frame: number }>(
  keys: readonly T[],
  frame: number,
  key: T | undefined,
  layerId: string,
): T[] {
  const result = keys.filter((entry) => entry.frame !== frame);
  if (key !== undefined) result.push(structuredClone(key));
  else if (result.length === keys.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Deformation keyframe not found", {
      details: { reason: "MESH_KEYFRAME_MISSING", layerId, frame },
    });
  return result.sort((a, b) => a.frame - b.frame);
}

/** Edit an isolated shot draft; the batch owner validates the complete geometry and references. */
export function applyShotDeformationEdit(result: ShotAnimation, edit: DeformationEdit): void {
  if (!locateLayer(result.layers, edit.layerId))
    throw new CodeboardError("INVALID_ARGUMENT", `Layer not found in animation: ${edit.layerId}`);
  if (
    edit.op === "layer.skin" ||
    edit.op === "layer.mesh" ||
    edit.op === "layer.curve" ||
    edit.op === "layer.envelope"
  ) {
    const bindings = (result.meshes ?? []).filter((entry) => entry.layerId !== edit.layerId);
    if (edit.op === "layer.skin" && edit.skin !== null)
      bindings.push({ layerId: edit.layerId, skin: structuredClone(edit.skin) });
    if (edit.op === "layer.mesh" && edit.mesh !== null)
      bindings.push({ layerId: edit.layerId, mesh: structuredClone(edit.mesh) });
    if (edit.op === "layer.curve" && edit.curve !== null)
      bindings.push({ layerId: edit.layerId, curve: structuredClone(edit.curve) });
    if (edit.op === "layer.envelope" && edit.envelope !== null)
      bindings.push({ layerId: edit.layerId, envelope: structuredClone(edit.envelope) });
    if (bindings.length) result.meshes = bindings;
    else delete result.meshes;
    return;
  }
  const binding = result.meshes?.find((entry) => entry.layerId === edit.layerId);
  if (!binding)
    throw new CodeboardError("INVALID_ARGUMENT", "Layer has no mesh binding", {
      details: { reason: "MESH_BINDING_MISSING", layerId: edit.layerId },
    });
  if (edit.op === "layer.skin.weights.put") {
    if (binding.skin === undefined)
      throw new CodeboardError("INVALID_ARGUMENT", "Weight edits require a skin binding", {
        details: { reason: "MESH_BINDING_KIND", layerId: edit.layerId },
      });
    if (edit.vertexIndex >= binding.skin.source.length)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Skin weight vertex is outside the source mesh",
        {
          details: {
            reason: "SKIN_WEIGHT_VERTEX",
            layerId: edit.layerId,
            vertexIndex: edit.vertexIndex,
          },
        },
      );
    const weights = [...binding.skin.weights];
    weights[edit.vertexIndex] = structuredClone(edit.influences);
    binding.skin = { ...binding.skin, weights };
    return;
  }
  if (edit.op === "layer.skin.bind.capture") {
    if (binding.skin === undefined)
      throw new CodeboardError("INVALID_ARGUMENT", "Bind capture requires a skin binding", {
        details: { reason: "MESH_BINDING_KIND", layerId: edit.layerId },
      });
    const poses = new Map(
      prepareLayerSkinPoses(
        edit.layerId,
        binding.skin,
        result,
      )(edit.frame).map((pose) => [pose.jointId, pose.matrix]),
    );
    binding.skin = {
      ...binding.skin,
      joints: binding.skin.joints.map((joint) => ({ ...joint, bind: poses.get(joint.id)! })),
    };
    return;
  }
  if (edit.op === "layer.deformation.rest.apply") {
    if (binding.skin !== undefined)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Skin rest poses require explicit joint layer key edits",
        {
          details: { reason: "SKIN_REST_REQUIRES_JOINT_KEYS", layerId: edit.layerId },
        },
      );
    const common = { frame: edit.frame, easing: edit.easing ?? ("linear" as const) };
    if (binding.mesh !== undefined)
      applyShotDeformationEdit(result, {
        op: "layer.mesh.key.put",
        layerId: edit.layerId,
        key: { ...common, vertices: binding.mesh.source },
      });
    else if (binding.curve !== undefined)
      applyShotDeformationEdit(result, {
        op: "layer.curve.key.put",
        layerId: edit.layerId,
        key: { ...binding.curve.rest, ...common },
      });
    else
      applyShotDeformationEdit(result, {
        op: "layer.envelope.key.put",
        layerId: edit.layerId,
        key: { ...common, pose: binding.envelope.rest },
      });
    return;
  }
  if (edit.op === "layer.mesh.key.put" || edit.op === "layer.mesh.key.remove") {
    if (binding.mesh === undefined)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Vertex key edits require a vertex mesh binding",
        {
          details: { reason: "MESH_BINDING_KIND", layerId: edit.layerId },
        },
      );
    binding.mesh = {
      ...binding.mesh,
      keyframes: reviseFrame(
        binding.mesh.keyframes,
        edit.op === "layer.mesh.key.put" ? edit.key.frame : edit.frame,
        edit.op === "layer.mesh.key.put" ? edit.key : undefined,
        edit.layerId,
      ),
    };
  } else if (edit.op === "layer.curve.key.put" || edit.op === "layer.curve.key.remove") {
    if (binding.curve === undefined)
      throw new CodeboardError("INVALID_ARGUMENT", "Curve key edits require a curve binding", {
        details: { reason: "MESH_BINDING_KIND", layerId: edit.layerId },
      });
    binding.curve = {
      ...binding.curve,
      keyframes: reviseFrame(
        binding.curve.keyframes,
        edit.op === "layer.curve.key.put" ? edit.key.frame : edit.frame,
        edit.op === "layer.curve.key.put" ? edit.key : undefined,
        edit.layerId,
      ),
    };
  } else {
    if (binding.envelope === undefined)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Envelope key edits require an envelope binding",
        {
          details: { reason: "MESH_BINDING_KIND", layerId: edit.layerId },
        },
      );
    binding.envelope = {
      ...binding.envelope,
      keyframes: reviseFrame(
        binding.envelope.keyframes,
        edit.op === "layer.envelope.key.put" ? edit.key.frame : edit.frame,
        edit.op === "layer.envelope.key.put" ? edit.key : undefined,
        edit.layerId,
      ),
    };
  }
}
