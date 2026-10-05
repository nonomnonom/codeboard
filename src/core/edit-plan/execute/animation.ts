import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { animationCommands } from "../schema/animation.js";
import { unsupportedCommand } from "./unsupported.js";

type Command = Extract<EditCommand, { op: keyof typeof animationCommands }>;

export function executeAnimation(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "layer.exposure":
      project.production.setExposure(command.id, command.exposure);
      break;
    case "drawing.sequence":
      project.production.setDrawingSequence(command.id, command.keys);
      break;
    case "drawing.range":
      project.production.setDrawingRange(
        command.id,
        command.startFrame,
        command.endFrame,
        command.drawingId,
      );
      break;
    case "rig.define":
      project.production.setTwoBoneRig(command.id, command.definition);
      break;
    case "rig.pose":
      project.production.poseTwoBoneRig(command.id, command.frame, command.target, {
        ...(command.bend === undefined ? {} : { bend: command.bend }),
        ...(command.unreachable === undefined ? {} : { unreachable: command.unreachable }),
      });
      break;
    case "camera.key":
      project.production.addCameraKeyframe(command.shotId, command.frame, command.value);
      break;
    case "camera.key.update":
      project.production.updateCameraKeyframe(command.shotId, command.id, command.changes);
      break;
    case "camera.key.remove":
      project.production.removeCameraKeyframe(command.shotId, command.id);
      break;
    case "camera.key.removeChannels":
      project.production.removeCameraKeyframeChannels(command.shotId, command.id, command.channels);
      break;
    case "layer.key":
      project.production.addLayerKeyframe(command.layerId, command.frame, command.value);
      break;
    case "layer.key.update":
      project.production.updateLayerKeyframe(command.layerId, command.id, command.changes);
      break;
    case "layer.key.remove":
      project.production.removeLayerKeyframe(command.layerId, command.id);
      break;
    case "layer.key.removeChannels":
      project.production.removeLayerKeyframeChannels(command.layerId, command.id, command.channels);
      break;
    default:
      unsupportedCommand(command);
  }
}
