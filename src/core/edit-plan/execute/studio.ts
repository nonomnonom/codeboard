import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { studioCommands } from "../schema/studio.js";
import { unsupportedCommand } from "./unsupported.js";
import { readPlanShotElement, decodePlanPixels } from "../artwork.js";
import { readPlanShotAnimation } from "../studio.js";

type Command = Extract<EditCommand, { op: keyof typeof studioCommands }>;

export function executeStudio(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "animation.element.add":
      project.addShotElement(
        command.animationId,
        command.layerId,
        readPlanShotElement(command.element),
      );
      break;
    case "animation.element.remove":
      project.removeShotElements(command.animationId, command.layerId, command.ids);
      break;
    case "animation.edit":
      project.editShotAnimation(command.id, command.edits);
      break;
    case "studio.audio.edit":
      project.editStudioAudio(command.ownerId, command.edits);
      break;
    case "studio.audio.set":
      project.setStudioAudio(command.ownerId, command.tracks);
      break;
    case "editorial.edit":
      project.editEditorial(command.id, command.edits);
      break;
    case "animation.duplicate": {
      const { op: _op, sourceAnimationId, ...options } = command;
      project.duplicateShotAnimation(sourceAnimationId, options);
      break;
    }
    case "animation.capturePanel":
      project.capturePanelAnimation(command.panelId, {
        id: command.id,
        ...(command.name === undefined ? {} : { name: command.name }),
        ...(command.preRollFrames === undefined ? {} : { preRollFrames: command.preRollFrames }),
        ...(command.postRollFrames === undefined ? {} : { postRollFrames: command.postRollFrames }),
      });
      break;
    case "animation.element.replace":
      project.reviseShotElement(
        command.animationId,
        command.layerId,
        command.id,
        readPlanShotElement(command.element),
      );
      break;
    case "animation.pixels.patch":
      project.patchShotPixels(
        command.animationId,
        command.layerId,
        command.id,
        command.region.x,
        command.region.y,
        decodePlanPixels(command.region.width, command.region.height, command.pixelsBase64),
      );
      break;
    case "animation.put":
      project.putShotAnimation(readPlanShotAnimation(command.animation));
      break;
    case "animation.remove":
      project.removeShotAnimation(command.id);
      break;
    case "editorial.put":
      project.putEditorialSequence(command.sequence);
      break;
    case "editorial.remove":
      project.removeEditorialSequence(command.id);
      break;
    default:
      unsupportedCommand(command);
  }
}
