import { executeStudio } from "./execute/studio.js";
import { executeTimeline } from "./execute/timeline.js";
import { executeArtwork } from "./execute/artwork.js";
import { executeAnimation } from "./execute/animation.js";
import { executeMedia } from "./execute/media.js";
import { executeCollaboration } from "./execute/collaboration.js";
import { unsupportedCommand } from "./execute/unsupported.js";
import type { StoryboardProject } from "../project.js";
import { CodeboardError } from "../../model/errors.js";
import type { EditPlan } from "./types.js";

export function executePlan(project: StoryboardProject, plan: EditPlan): void {
  project.transaction(plan.label, () => {
    for (const [index, command] of plan.commands.entries()) {
      try {
        switch (command.op) {
          case "animation.element.add":
          case "animation.element.remove":
          case "animation.edit":
          case "studio.audio.edit":
          case "studio.audio.set":
          case "editorial.edit":
          case "animation.capturePanel":
          case "animation.duplicate":
          case "animation.element.replace":
          case "animation.pixels.patch":
          case "animation.put":
          case "animation.remove":
          case "editorial.put":
          case "editorial.remove":
            executeStudio(project, command);
            break;
          case "project.configure":
          case "project.metadata":
          case "script.replace":
          case "panel.revise":
          case "panel.status":
          case "sequence.add":
          case "scene.add":
          case "shot.add":
          case "panel.add":
          case "panel.duration":
          case "panel.transition":
          case "panel.number":
          case "panel.move":
          case "panel.duplicate":
          case "panel.remove":
            executeTimeline(project, command);
            break;
          case "palette.put":
          case "palette.remove":
          case "palette.bind":
          case "layer.set":
          case "layer.depth":
          case "layer.add":
          case "layer.move":
          case "layer.reparent":
          case "layer.remove":
          case "element.add":
          case "element.replace":
          case "element.remove":
          case "element.outline":
          case "element.boolean":
          case "pixels.patch":
          case "brush.create":
          case "brush.revise":
          case "brush.duplicate":
          case "component.capture":
          case "component.revise":
          case "component.upgrade":
          case "component.source.replace":
          case "component.element.replace":
          case "component.instantiate":
          case "component.refresh":
            executeArtwork(project, command);
            break;
          case "layer.exposure":
          case "drawing.sequence":
          case "drawing.range":
          case "rig.define":
          case "rig.pose":
          case "camera.key":
          case "camera.key.update":
          case "camera.key.remove":
          case "camera.key.removeChannels":
          case "layer.key":
          case "layer.key.update":
          case "layer.key.remove":
          case "layer.key.removeChannels":
            executeAnimation(project, command);
            break;
          case "audio.track.add":
          case "audio.track.update":
          case "audio.track.remove":
          case "audio.clip.add":
          case "audio.clip.update":
          case "audio.clip.remove":
          case "audio.clip.move":
          case "audio.clip.split":
          case "asset.add":
          case "asset.update":
            executeMedia(project, command);
            break;
          case "review.comment":
          case "review.resolve":
          case "lock.acquire":
          case "lock.release":
            executeCollaboration(project, command);
            break;
          default:
            unsupportedCommand(command);
        }
      } catch (cause) {
        if (cause instanceof CodeboardError)
          throw new CodeboardError(cause.code, cause.message, {
            retryable: cause.retryable,
            details: {
              ...cause.details,
              commandIndex: index,
              commandOperation: command.op,
            },
            cause,
          });
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Edit command ${index} (${command.op}) failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          {
            details: { commandIndex: index, commandOperation: command.op, operation: command.op },
            cause,
          },
        );
      }
    }
  });
}
