import { applyShotControllerEdit } from "./controller-edit.js";
import { replaceDrawingRange } from "./drawing-range.js";
import { prepareLayerPose } from "./layer-pose.js";
import { captureTwoBoneRest, prepareTwoBoneRest } from "./rig-rest.js";
import { prepareTwoBonePose, prepareTwoBonePoseKeys } from "./rig-pose.js";
import { locateLayer } from "../model/layer-tree.js";
import { applyShotDeformationEdit } from "./shot-deformation.js";
import { applyShotHierarchyEdit } from "./shot-hierarchy.js";
import type { ShotAnimation, ShotAnimationEdit } from "../model/types/shot.js";
import { shotAnimationEditsSchema } from "../model/schema/shot.js";
import { defineShotAnimation } from "./shot.js";
import { retimeShotAnimation } from "./shot-retime.js";
import { CodeboardError, throwEditError } from "../model/errors.js";

export function reviseShotAnimation(
  animation: ShotAnimation,
  edits: readonly ShotAnimationEdit[],
): ShotAnimation {
  const parsed = shotAnimationEditsSchema.safeParse(edits);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot animation edits", {
      details: { issues: parsed.error.issues },
    });
  let result = defineShotAnimation(animation);
  const layer = (id: string) => {
    const found = locateLayer(result.layers, id)?.layer;
    if (!found) throw new CodeboardError("INVALID_ARGUMENT", `Layer not found in animation: ${id}`);
    return found;
  };
  const put = <T extends { id: string; frame: number }>(keys: T[], key: T) => {
    const index = keys.findIndex((item) => item.id === key.id);
    if (index < 0) keys.push(key);
    else keys[index] = key;
    keys.sort((a, b) => a.frame - b.frame);
  };
  const remove = (keys: { id: string }[], id: string) => {
    const index = keys.findIndex((key) => key.id === id);
    if (index < 0) throw new CodeboardError("INVALID_ARGUMENT", `Animation key not found: ${id}`);
    keys.splice(index, 1);
  };
  for (const [editIndex, edit] of (parsed.data as ShotAnimationEdit[]).entries()) {
    try {
      switch (edit.op) {
        case "timing.retime": {
          const { op: _op, ...options } = edit;
          result = retimeShotAnimation(result, options).animation;
          break;
        }
        case "compositing.set":
          if (edit.graph === null) delete result.compositing;
          else result.compositing = structuredClone(edit.graph);
          break;
        case "controller.put":
        case "controller.remove":
        case "controller.range":
        case "controller.weight":
        case "controller.key.put":
        case "controller.key.remove":
        case "controller.move":
          applyShotControllerEdit(result, edit);
          break;
        case "layer.mesh":
        case "layer.deformation.rest.apply":
        case "layer.skin.bind.capture":
        case "layer.skin.weights.put":
        case "layer.skin":
        case "layer.envelope":
        case "layer.envelope.key.put":
        case "layer.envelope.key.remove":
        case "layer.curve":
        case "layer.mesh.key.put":
        case "layer.mesh.key.remove":
        case "layer.curve.key.put":
        case "layer.curve.key.remove":
          applyShotDeformationEdit(result, edit);
          break;
        case "board.link":
          result.boardPanelIds = [...edit.panelIds];
          break;
        case "layer.pose": {
          const target = layer(edit.layerId);
          put(target.keyframes, prepareLayerPose(target, edit));
          break;
        }
        case "layer.rig.rest.capture": {
          const root = layer(edit.layerId);
          if (root.kind !== "group")
            throw new CodeboardError("INVALID_ARGUMENT", "Rig rest capture requires a group layer");
          const restPose = captureTwoBoneRest(root, edit.frame);
          root.twoBoneRig = { ...root.twoBoneRig!, restPose };
          break;
        }
        case "layer.rig.rest.apply": {
          const root = layer(edit.layerId);
          if (root.kind !== "group")
            throw new CodeboardError("INVALID_ARGUMENT", "Rig rest apply requires a group layer");
          const prepared = prepareTwoBoneRest(root, edit);
          put(root.keyframes, prepared.rootKey);
          put(prepared.elbow.keyframes, prepared.elbowKey);
          break;
        }
        case "layer.rig.pose": {
          const root = layer(edit.layerId);
          if (root.kind !== "group")
            throw new CodeboardError("INVALID_ARGUMENT", "Rig pose requires a group layer");
          const prepared = prepareTwoBonePose(root, edit.frame, edit.target, edit);
          const keys = prepareTwoBonePoseKeys(root, prepared, {
            root: edit.rootKeyId,
            elbow: edit.elbowKeyId,
          });
          root.keyframes = keys.root;
          prepared.elbow.keyframes = keys.elbow;
          break;
        }
        case "layer.add":
        case "layer.move":
        case "layer.remove":
          applyShotHierarchyEdit(result, edit);
          break;

        case "layer.rig": {
          const target = layer(edit.layerId);
          if (target.kind !== "group")
            throw new CodeboardError("INVALID_ARGUMENT", "A two-bone rig requires a group layer");
          if (edit.definition === null) delete target.twoBoneRig;
          else target.twoBoneRig = structuredClone(edit.definition);
          break;
        }
        case "layer.depth": {
          const target = layer(edit.layerId);
          if (!result.layers.includes(target))
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Multiplane depth requires a top-level layer",
            );
          target.depth = edit.depth;
          break;
        }
        case "layer.set": {
          const target = layer(edit.layerId),
            { maskLayerId, ...changes } = edit.changes;
          Object.assign(target, structuredClone(changes));
          if (maskLayerId === null) delete target.maskLayerId;
          else if (maskLayerId !== undefined) target.maskLayerId = maskLayerId;
          break;
        }
        case "layer.exposure":
          layer(edit.layerId).exposure = structuredClone(edit.exposure);
          break;
        case "layer.drawing.range": {
          const target = layer(edit.layerId);
          if (target.kind !== "group" || target.drawingSequence === undefined)
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Drawing range requires a drawing-sequence group",
              {
                details: { reason: "DRAWING_RANGE_OWNER", layerId: edit.layerId },
              },
            );
          target.drawingSequence = replaceDrawingRange(
            target.drawingSequence,
            edit.startFrame,
            edit.endFrame,
            edit.drawingId,
          );
          break;
        }
        case "layer.drawings": {
          const target = layer(edit.layerId);
          if (target.kind !== "group")
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Drawing alternatives require a group layer",
            );
          if (edit.keys === null) delete target.drawingSequence;
          else target.drawingSequence = structuredClone(edit.keys);
          break;
        }
        case "layer.key.put":
          put(layer(edit.layerId).keyframes, structuredClone(edit.key));
          break;
        case "layer.key.remove":
          remove(layer(edit.layerId).keyframes, edit.id);
          break;
        case "camera.key.put":
          put(result.cameraKeyframes, structuredClone(edit.key));
          break;
        case "camera.key.remove":
          remove(result.cameraKeyframes, edit.id);
          break;
      }
    } catch (cause) {
      throwEditError(cause, "shot-animation", editIndex, edit.op);
    }
  }
  return defineShotAnimation(result);
}
